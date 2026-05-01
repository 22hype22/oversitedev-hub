-- ============================================================
-- Worker authentication refactor
-- 
-- Goal: Allow the worker to operate with the public anon key +
-- WORKER_TOKEN, removing the need for the SUPABASE_SERVICE_ROLE_KEY.
-- 
-- Security model: every RPC validates _token via _worker_token_lookup.
-- The auth.role() = 'service_role' check is REMOVED because the
-- worker token itself proves this is an authorized worker call.
-- (RLS still protects all underlying tables from anon clients.)
-- ============================================================

-- ── 1. Drop the service_role gate from EXISTING runtime_* RPCs ──
-- (Kept identical otherwise — only the auth.role() check is removed)

CREATE OR REPLACE FUNCTION public.runtime_claim_next_command(_token text, _worker_id text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _tok RECORD;
  _cmd public.bot_commands%ROWTYPE;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  WITH next AS (
    SELECT id FROM public.bot_commands
    WHERE status = 'pending'
      AND (_tok.bot_id IS NULL OR bot_id = _tok.bot_id)
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
  )
  UPDATE public.bot_commands c
    SET status = 'claimed', claimed_at = now(),
        worker_id = COALESCE(_worker_id, c.worker_id), updated_at = now()
    FROM next WHERE c.id = next.id RETURNING c.* INTO _cmd;

  UPDATE public.worker_tokens SET last_used_at = now() WHERE id = _tok.token_id;

  IF _cmd.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'command', NULL); END IF;
  RETURN jsonb_build_object('ok', true, 'command', to_jsonb(_cmd));
END; $$;

CREATE OR REPLACE FUNCTION public.runtime_complete_command(_token text, _command_id uuid, _status text, _error text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD;
BEGIN
  IF _status NOT IN ('done','failed') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_status'); END IF;
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_token'); END IF;

  UPDATE public.bot_commands
    SET status = _status, error_message = _error, completed_at = now(), updated_at = now()
  WHERE id = _command_id AND (_tok.bot_id IS NULL OR bot_id = _tok.bot_id);
  RETURN jsonb_build_object('ok', true);
END; $$;

-- The remaining runtime_* fns (set_bot_status, append_bot_log, record_bot_metrics,
-- get_bot_secret, upsert_bot_guild, remove_bot_guild) currently take NO _token arg.
-- They rely solely on auth.role() = 'service_role'. We need to add token-based auth.
-- 
-- To keep the worker code change minimal we'll add an OVERLOAD that takes _token first,
-- and leave the originals working (still service_role) for backwards compatibility.

CREATE OR REPLACE FUNCTION public.runtime_set_bot_status(
  _token text, _bot_id uuid, _status text,
  _last_error text DEFAULT NULL, _worker_id text DEFAULT NULL,
  _version text DEFAULT NULL, _details jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _tok RECORD; _bot_owner UUID; _now TIMESTAMPTZ := now();
  _existing public.bot_runtime_status%ROWTYPE; _new_uptime INTEGER := 0; _started TIMESTAMPTZ;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _status NOT IN ('online','offline','starting','stopping','crashed','updating','suspended') THEN
    RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN RAISE EXCEPTION 'token_bot_mismatch'; END IF;

  SELECT * INTO _existing FROM public.bot_runtime_status WHERE bot_id = _bot_id;
  IF _existing.bot_id IS NULL THEN
    _started := CASE WHEN _status = 'online' THEN _now ELSE NULL END; _new_uptime := 0;
  ELSE
    IF _status = 'online' AND _existing.status <> 'online' THEN _started := _now; _new_uptime := 0;
    ELSIF _status = 'online' AND _existing.started_at IS NOT NULL THEN
      _started := _existing.started_at;
      _new_uptime := EXTRACT(EPOCH FROM (_now - _existing.started_at))::int;
    ELSE _started := _existing.started_at; _new_uptime := _existing.uptime_seconds; END IF;
  END IF;

  INSERT INTO public.bot_runtime_status
    (bot_id, user_id, status, last_heartbeat_at, started_at, uptime_seconds,
     last_error, last_error_at, worker_id, version, details)
  VALUES
    (_bot_id, _bot_owner, _status, _now, _started, _new_uptime,
     _last_error, CASE WHEN _last_error IS NOT NULL THEN _now ELSE NULL END,
     _worker_id, _version, _details)
  ON CONFLICT (bot_id) DO UPDATE SET
    status = EXCLUDED.status, last_heartbeat_at = EXCLUDED.last_heartbeat_at,
    started_at = EXCLUDED.started_at, uptime_seconds = EXCLUDED.uptime_seconds,
    last_error = COALESCE(EXCLUDED.last_error, public.bot_runtime_status.last_error),
    last_error_at = COALESCE(EXCLUDED.last_error_at, public.bot_runtime_status.last_error_at),
    worker_id = COALESCE(EXCLUDED.worker_id, public.bot_runtime_status.worker_id),
    version = COALESCE(EXCLUDED.version, public.bot_runtime_status.version),
    details = COALESCE(EXCLUDED.details, public.bot_runtime_status.details),
    user_id = EXCLUDED.user_id;
  RETURN jsonb_build_object('ok', true, 'bot_id', _bot_id, 'status', _status);
END; $$;

CREATE OR REPLACE FUNCTION public.runtime_append_bot_log(
  _token text, _bot_id uuid, _level text, _message text, _context jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD; _bot_owner UUID;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN RAISE EXCEPTION 'token_bot_mismatch'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  INSERT INTO public.bot_logs (bot_id, user_id, level, message, context)
  VALUES (_bot_id, _bot_owner, _level, _message, _context);
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.runtime_record_bot_metrics(
  _token text, _bot_id uuid,
  _commands_delta integer DEFAULT 0, _messages_delta integer DEFAULT 0,
  _errors_delta integer DEFAULT 0, _active_servers integer DEFAULT NULL,
  _member_count integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD; _bot_owner UUID; _bucket TIMESTAMPTZ := date_trunc('hour', now());
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN RAISE EXCEPTION 'token_bot_mismatch'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  INSERT INTO public.bot_usage_metrics
    (bot_id, user_id, bucket_start, commands_count, messages_count, errors_count,
     active_servers, member_count)
  VALUES (_bot_id, _bot_owner, _bucket, GREATEST(_commands_delta,0), GREATEST(_messages_delta,0),
          GREATEST(_errors_delta,0), COALESCE(_active_servers,0), COALESCE(_member_count,0))
  ON CONFLICT (bot_id, bucket_start) DO UPDATE SET
    commands_count = public.bot_usage_metrics.commands_count + GREATEST(_commands_delta,0),
    messages_count = public.bot_usage_metrics.messages_count + GREATEST(_messages_delta,0),
    errors_count = public.bot_usage_metrics.errors_count + GREATEST(_errors_delta,0),
    active_servers = COALESCE(_active_servers, public.bot_usage_metrics.active_servers),
    member_count = COALESCE(_member_count, public.bot_usage_metrics.member_count),
    updated_at = now();
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.runtime_get_bot_secret(_token text, _bot_id uuid, _key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD; _value text;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN RAISE EXCEPTION 'token_bot_mismatch'; END IF;
  SELECT convert_from(
    pgsodium.crypto_aead_det_decrypt(value_encrypted, convert_to(bot_id::text || ':' || key, 'utf8'), 
      (SELECT id FROM pgsodium.key WHERE name = 'bot_secrets_key' LIMIT 1)),
    'utf8') INTO _value
  FROM public.bot_secrets WHERE bot_id = _bot_id AND key = _key;
  IF _value IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('ok', true, 'value', _value);
END; $$;

CREATE OR REPLACE FUNCTION public.runtime_upsert_bot_guild(
  _token text, _bot_id uuid, _guild_id text, _guild_name text DEFAULT NULL, _member_count integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD; _bot_owner UUID;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN RAISE EXCEPTION 'token_bot_mismatch'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  INSERT INTO public.bot_active_guilds (bot_id, user_id, guild_id, guild_name, member_count)
  VALUES (_bot_id, _bot_owner, _guild_id, _guild_name, _member_count)
  ON CONFLICT (bot_id, guild_id) DO UPDATE SET
    guild_name = COALESCE(EXCLUDED.guild_name, public.bot_active_guilds.guild_name),
    member_count = COALESCE(EXCLUDED.member_count, public.bot_active_guilds.member_count),
    last_seen_at = now();
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.runtime_remove_bot_guild(_token text, _bot_id uuid, _guild_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN RAISE EXCEPTION 'token_bot_mismatch'; END IF;
  DELETE FROM public.bot_active_guilds WHERE bot_id = _bot_id AND guild_id = _guild_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- ── 2. NEW RPCs to replace direct table ops in worker/src/index.ts ──

CREATE OR REPLACE FUNCTION public.runtime_load_bot_config(_token text, _bot_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD; _row public.bot_orders%ROWTYPE;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN RAISE EXCEPTION 'token_bot_mismatch'; END IF;
  SELECT * INTO _row FROM public.bot_orders WHERE id = _bot_id;
  IF _row.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'config', NULL); END IF;
  RETURN jsonb_build_object('ok', true, 'config', jsonb_build_object(
    'id', _row.id, 'user_id', _row.user_id, 'bot_name', _row.bot_name,
    'base', _row.base, 'addons', _row.addons, 'monthly_hosting', _row.monthly_hosting,
    'status', _row.status, 'notes', _row.notes, 'icon_url', _row.icon_url,
    'bot_description', _row.bot_description));
END; $$;

CREATE OR REPLACE FUNCTION public.runtime_claim_build_job(_token text, _worker_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD; _job public.bot_build_jobs%ROWTYPE;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  WITH next AS (
    SELECT id FROM public.bot_build_jobs
    WHERE status = 'pending' AND attempts < 3
    ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
  )
  UPDATE public.bot_build_jobs j
    SET status = 'building', worker_id = _worker_id,
        claimed_at = now(), attempts = j.attempts + 1, updated_at = now()
    FROM next WHERE j.id = next.id RETURNING j.* INTO _job;
  IF _job.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'job', NULL); END IF;
  RETURN jsonb_build_object('ok', true, 'job', to_jsonb(_job));
END; $$;

CREATE OR REPLACE FUNCTION public.runtime_finalize_build(
  _token text, _job_id uuid, _bot_order_id uuid, _bot_name text, _base text,
  _addons text[], _icon_url text, _banner_url text, _bot_description text, _build_log text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  UPDATE public.bot_orders SET
    bot_name = _bot_name, base = _base, addons = COALESCE(_addons, '{}'::text[]),
    icon_url = _icon_url, banner_url = _banner_url,
    bot_description = _bot_description, status = 'ready', updated_at = now()
  WHERE id = _bot_order_id;
  UPDATE public.bot_build_jobs SET status = 'ready', build_log = _build_log,
    completed_at = now(), updated_at = now() WHERE id = _job_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.runtime_fail_build(
  _token text, _job_id uuid, _bot_order_id uuid, _build_log text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  UPDATE public.bot_build_jobs SET status = 'failed', build_log = _build_log,
    error_message = _build_log, completed_at = now(), updated_at = now() WHERE id = _job_id;
  UPDATE public.bot_orders SET status = 'build_failed', updated_at = now() WHERE id = _bot_order_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.runtime_seed_secret_slots(_token text, _slots jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD; _slot jsonb;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  FOR _slot IN SELECT * FROM jsonb_array_elements(_slots) LOOP
    INSERT INTO public.bot_secret_slots (addon_id, key, label, description, placeholder, is_required, sort_order)
    VALUES (
      COALESCE(_slot->>'addon_id', _slot->>'bot_id'),
      _slot->>'key', _slot->>'label', _slot->>'description', _slot->>'placeholder',
      COALESCE((_slot->>'required')::boolean, (_slot->>'is_required')::boolean, true),
      COALESCE((_slot->>'sort_order')::integer, 0))
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.runtime_enqueue_notification(
  _token text, _bot_id uuid, _event_type text, _title text, _body text, _context jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _tok RECORD; _bot_owner UUID;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  INSERT INTO public.bot_notifications (bot_id, user_id, event_type, title, body, context)
  VALUES (_bot_id, _bot_owner, _event_type, _title, _body, _context);
  RETURN jsonb_build_object('ok', true);
END; $$;

-- ── 3. Allow the anon role to call these RPCs (token check still gates them) ──
GRANT EXECUTE ON FUNCTION public.runtime_claim_next_command(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_complete_command(text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_set_bot_status(text, uuid, text, text, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_append_bot_log(text, uuid, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_record_bot_metrics(text, uuid, integer, integer, integer, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_get_bot_secret(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_upsert_bot_guild(text, uuid, text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_remove_bot_guild(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_load_bot_config(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_claim_build_job(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_finalize_build(text, uuid, uuid, text, text, text[], text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_fail_build(text, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_seed_secret_slots(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_enqueue_notification(text, uuid, text, text, text, jsonb) TO anon, authenticated;