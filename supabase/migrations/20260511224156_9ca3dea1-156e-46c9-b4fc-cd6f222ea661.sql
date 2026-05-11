ALTER TABLE public.bot_runtime_status
ADD COLUMN IF NOT EXISTS guilds jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.runtime_set_bot_status(
  _token text,
  _bot_id uuid,
  _status text,
  _last_error text DEFAULT NULL,
  _worker_id text DEFAULT NULL,
  _version text DEFAULT NULL,
  _details jsonb DEFAULT NULL,
  _guilds jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tok RECORD;
  _bot_owner UUID;
  _now TIMESTAMPTZ := now();
  _existing public.bot_runtime_status%ROWTYPE;
  _new_uptime INTEGER := 0;
  _started TIMESTAMPTZ;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _status NOT IN ('online','offline','starting','stopping','crashed','updating','suspended') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  IF _guilds IS NOT NULL AND jsonb_typeof(_guilds) <> 'array' THEN
    RAISE EXCEPTION 'guilds must be a JSON array';
  END IF;

  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN RAISE EXCEPTION 'token_bot_mismatch'; END IF;

  SELECT * INTO _existing FROM public.bot_runtime_status WHERE bot_id = _bot_id;
  IF _existing.bot_id IS NULL THEN
    _started := CASE WHEN _status = 'online' THEN _now ELSE NULL END;
    _new_uptime := 0;
  ELSE
    IF _status = 'online' AND _existing.status <> 'online' THEN
      _started := _now;
      _new_uptime := 0;
    ELSIF _status = 'online' AND _existing.started_at IS NOT NULL THEN
      _started := _existing.started_at;
      _new_uptime := EXTRACT(EPOCH FROM (_now - _existing.started_at))::int;
    ELSE
      _started := _existing.started_at;
      _new_uptime := _existing.uptime_seconds;
    END IF;
  END IF;

  INSERT INTO public.bot_runtime_status
    (bot_id, user_id, status, last_heartbeat_at, started_at, uptime_seconds,
     last_error, last_error_at, worker_id, version, details, guilds)
  VALUES
    (_bot_id, _bot_owner, _status, _now, _started, _new_uptime,
     _last_error, CASE WHEN _last_error IS NOT NULL THEN _now ELSE NULL END,
     _worker_id, _version, _details, COALESCE(_guilds, '[]'::jsonb))
  ON CONFLICT (bot_id) DO UPDATE SET
    status = EXCLUDED.status,
    last_heartbeat_at = EXCLUDED.last_heartbeat_at,
    started_at = EXCLUDED.started_at,
    uptime_seconds = EXCLUDED.uptime_seconds,
    last_error = COALESCE(EXCLUDED.last_error, public.bot_runtime_status.last_error),
    last_error_at = COALESCE(EXCLUDED.last_error_at, public.bot_runtime_status.last_error_at),
    worker_id = COALESCE(EXCLUDED.worker_id, public.bot_runtime_status.worker_id),
    version = COALESCE(EXCLUDED.version, public.bot_runtime_status.version),
    details = COALESCE(EXCLUDED.details, public.bot_runtime_status.details),
    guilds = COALESCE(_guilds, public.bot_runtime_status.guilds),
    user_id = EXCLUDED.user_id,
    updated_at = _now;

  RETURN jsonb_build_object('ok', true, 'bot_id', _bot_id, 'status', _status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.runtime_set_bot_status(text, uuid, text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_set_bot_status(text, uuid, text, text, text, text, jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.get_bot_server_limit(_bot_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _extra INTEGER := 0;
  _current INTEGER := 0;
  _status TEXT := 'inactive';
  _period_end TIMESTAMPTZ;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  IF _bot_owner <> _user_id
     AND NOT public.has_role(_user_id, 'admin'::app_role)
     AND NOT public.has_support_access(_user_id, _bot_owner) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT extra_slots, status, current_period_end
    INTO _extra, _status, _period_end
  FROM public.bot_server_slots WHERE bot_id = _bot_id;

  IF _status NOT IN ('active','trialing') THEN
    _extra := 0;
  END IF;

  SELECT jsonb_array_length(guilds)
    INTO _current
  FROM public.bot_runtime_status
  WHERE bot_id = _bot_id AND guilds IS NOT NULL;

  IF _current IS NULL THEN
    SELECT COUNT(*) INTO _current FROM public.bot_active_guilds WHERE bot_id = _bot_id;
  END IF;

  RETURN jsonb_build_object(
    'bot_id', _bot_id,
    'limit', 1 + COALESCE(_extra, 0),
    'extra_slots', COALESCE(_extra, 0),
    'current_count', COALESCE(_current, 0),
    'subscription_status', _status,
    'current_period_end', _period_end
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_bot_server_limit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bot_server_limit(uuid) TO authenticated;

ALTER TABLE public.bot_runtime_status REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_runtime_status;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;