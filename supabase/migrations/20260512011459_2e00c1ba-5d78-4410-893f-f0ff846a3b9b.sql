CREATE OR REPLACE FUNCTION public.runtime_set_bot_status(_token text, _bot_id uuid, _status text, _last_error text DEFAULT NULL::text, _worker_id text DEFAULT NULL::text, _version text DEFAULT NULL::text, _details jsonb DEFAULT NULL::jsonb, _guilds jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tok RECORD;
  _bot_owner UUID;
  _now TIMESTAMPTZ := now();
  _existing public.bot_runtime_status%ROWTYPE;
  _new_uptime INTEGER := 0;
  _started TIMESTAMPTZ;
  _status_guilds jsonb := NULL;
  _g jsonb;
  _gid text;
  _gname text;
  _mc int;
  _existing_status_count int;
  _existing_active_count int;
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

  IF _guilds IS NOT NULL THEN
    _status_guilds := '[]'::jsonb;
    FOR _g IN SELECT * FROM jsonb_array_elements(_guilds) LOOP
      _gid := COALESCE(_g->>'id', _g->>'guild_id');
      _gname := COALESCE(_g->>'name', _g->>'guild_name');
      _mc := NULLIF(_g->>'member_count', '')::int;

      IF _gid IS NULL OR _gid = '' THEN
        CONTINUE;
      END IF;

      IF _mc IS NULL OR _mc = 0 THEN
        SELECT NULLIF(sg->>'member_count', '')::int INTO _existing_status_count
        FROM public.bot_runtime_status brs
        CROSS JOIN LATERAL jsonb_array_elements(brs.guilds) sg
        WHERE brs.bot_id = _bot_id
          AND sg->>'id' = _gid
          AND sg->>'member_count' IS NOT NULL
          AND sg->>'member_count' <> 'null'
        LIMIT 1;

        SELECT member_count INTO _existing_active_count
        FROM public.bot_active_guilds
        WHERE bot_id = _bot_id AND guild_id = _gid;

        _mc := COALESCE(NULLIF(_existing_status_count, 0), NULLIF(_existing_active_count, 0));
      END IF;

      _status_guilds := _status_guilds || jsonb_build_array(jsonb_build_object(
        'id', _gid,
        'name', _gname,
        'member_count', _mc
      ));
    END LOOP;
  END IF;

  INSERT INTO public.bot_runtime_status
    (bot_id, user_id, status, last_heartbeat_at, started_at, uptime_seconds,
     last_error, last_error_at, worker_id, version, details, guilds)
  VALUES
    (_bot_id, _bot_owner, _status, _now, _started, _new_uptime,
     _last_error, CASE WHEN _last_error IS NOT NULL THEN _now ELSE NULL END,
     _worker_id, _version, _details, COALESCE(_status_guilds, '[]'::jsonb))
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
    guilds = COALESCE(_status_guilds, public.bot_runtime_status.guilds),
    user_id = EXCLUDED.user_id,
    updated_at = _now;

  RETURN jsonb_build_object('ok', true, 'bot_id', _bot_id, 'status', _status);
END;
$function$;