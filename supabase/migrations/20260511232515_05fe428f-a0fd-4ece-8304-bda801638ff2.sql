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
  _is_admin BOOLEAN := false;
  _limit INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  IF _bot_owner <> _user_id
     AND NOT public.has_role(_user_id, 'admin'::app_role)
     AND NOT public.has_support_access(_user_id, _bot_owner) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  _is_admin := public.has_role(_bot_owner, 'admin'::app_role);

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

  IF _current IS NULL OR _current = 0 THEN
    SELECT COUNT(*) INTO _current FROM public.bot_active_guilds WHERE bot_id = _bot_id;
  END IF;

  IF _is_admin THEN
    _limit := 999999;
  ELSE
    _limit := 1 + COALESCE(_extra, 0);
  END IF;

  RETURN jsonb_build_object(
    'bot_id', _bot_id,
    'limit', _limit,
    'extra_slots', COALESCE(_extra, 0),
    'current_count', COALESCE(_current, 0),
    'is_unlimited', _is_admin,
    'subscription_status', _status,
    'current_period_end', _period_end
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_bot_server_limit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bot_server_limit(uuid) TO authenticated;