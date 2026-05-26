CREATE OR REPLACE FUNCTION public.runtime_upsert_bot_guild(
  _bot_id UUID,
  _guild_id TEXT,
  _guild_name TEXT DEFAULT NULL,
  _member_count INTEGER DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bot_owner UUID;
  _extra INTEGER := 0;
  _is_admin BOOLEAN := false;
  _limit INTEGER;
  _current INTEGER;
  _exists BOOLEAN;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;

  -- Record this guild as authorized for the bot (joined via invite link).
  -- Done before slot-limit check so we keep a permanent record of every join.
  INSERT INTO public.authorized_guilds (bot_order_id, guild_id)
  VALUES (_bot_id, _guild_id)
  ON CONFLICT (bot_order_id, guild_id) DO NOTHING;

  _is_admin := public.has_role(_bot_owner, 'admin'::app_role);

  SELECT extra_slots INTO _extra
  FROM public.user_extra_server_slots WHERE user_id = _bot_owner;
  _extra := COALESCE(_extra, 0);

  IF _is_admin THEN
    _limit := 999999;
  ELSE
    _limit := 1 + _extra;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.bot_active_guilds WHERE bot_id = _bot_id AND guild_id = _guild_id
  ) INTO _exists;

  IF NOT _exists THEN
    SELECT COUNT(*) INTO _current FROM public.bot_active_guilds WHERE bot_id = _bot_id;
    IF _current >= _limit THEN
      RETURN jsonb_build_object('ok', true, 'allowed', false, 'limit', _limit, 'current', _current);
    END IF;
  END IF;

  INSERT INTO public.bot_active_guilds (bot_id, user_id, guild_id, guild_name, member_count)
  VALUES (_bot_id, _bot_owner, _guild_id, _guild_name, _member_count)
  ON CONFLICT (bot_id, guild_id) DO UPDATE
    SET guild_name = COALESCE(EXCLUDED.guild_name, public.bot_active_guilds.guild_name),
        member_count = COALESCE(EXCLUDED.member_count, public.bot_active_guilds.member_count),
        last_seen_at = now();

  RETURN jsonb_build_object('ok', true, 'allowed', true, 'limit', _limit);
END;
$$;