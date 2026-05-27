CREATE OR REPLACE FUNCTION public.runtime_upsert_bot_guild(_token text, _bot_id uuid, _guild_id text, _guild_name text DEFAULT NULL::text, _member_count integer DEFAULT NULL::integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _tok RECORD; _bot_owner UUID;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN RAISE EXCEPTION 'token_bot_mismatch'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;

  -- Permanent record of every guild the bot has ever joined via invite link.
  INSERT INTO public.authorized_guilds (bot_order_id, guild_id)
  VALUES (_bot_id, _guild_id)
  ON CONFLICT (bot_order_id, guild_id) DO NOTHING;

  INSERT INTO public.bot_active_guilds (bot_id, user_id, guild_id, guild_name, member_count)
  VALUES (_bot_id, _bot_owner, _guild_id, _guild_name, _member_count)
  ON CONFLICT (bot_id, guild_id) DO UPDATE SET
    guild_name = COALESCE(EXCLUDED.guild_name, public.bot_active_guilds.guild_name),
    member_count = COALESCE(EXCLUDED.member_count, public.bot_active_guilds.member_count),
    last_seen_at = now();
  RETURN jsonb_build_object('ok', true);
END; $function$;