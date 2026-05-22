CREATE OR REPLACE FUNCTION public.get_bot_health(_bot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _row public.bot_runtime_status%ROWTYPE;
  _effective TEXT;
  _stale BOOLEAN := false;
  _seconds_since INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN
    RAISE EXCEPTION 'Bot not found';
  END IF;
  IF _bot_owner <> _user_id
     AND NOT public.has_role(_user_id, 'admin'::app_role)
     AND NOT public.has_support_access(_user_id, _bot_owner)
     AND NOT public.has_team_access(_user_id, _bot_owner) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO _row FROM public.bot_runtime_status WHERE bot_id = _bot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'bot_id', _bot_id,
      'status', 'offline',
      'effective_status', 'offline',
      'never_started', true,
      'uptime_seconds', 0
    );
  END IF;

  _effective := _row.status;

  IF _row.last_heartbeat_at IS NOT NULL THEN
    _seconds_since := EXTRACT(EPOCH FROM (now() - _row.last_heartbeat_at))::int;
    -- Heartbeat-first: if the worker has pinged within the last 60s, the bot
    -- is live regardless of what the stored `status` column says (it may lag
    -- behind heartbeats during transient transitions like start/restart).
    IF _seconds_since <= 60 THEN
      IF _row.status NOT IN ('stopping','suspended','crashed','updating') THEN
        _effective := 'online';
      END IF;
      _stale := false;
    ELSIF _row.status IN ('online','starting','stopping','updating') THEN
      -- Stored status claims live, but no heartbeat in >60s → effectively offline.
      _effective := 'offline';
      _stale := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'bot_id', _bot_id,
    'status', _row.status,
    'effective_status', _effective,
    'stale', _stale,
    'last_heartbeat_at', _row.last_heartbeat_at,
    'started_at', _row.started_at,
    'uptime_seconds', _row.uptime_seconds,
    'last_error', _row.last_error,
    'last_error_at', _row.last_error_at,
    'version', _row.version,
    'updated_at', _row.updated_at
  );
END;
$function$;