-- Fix runtime_upsert_bot_channels: it called bare digest() which isn't in the
-- function's search_path (public). That made worker token validation fail
-- silently, so channel caches were never written even though the worker
-- thought it succeeded. Switch to the shared _worker_token_lookup helper
-- (used by every other runtime_* RPC) for consistency.
CREATE OR REPLACE FUNCTION public.runtime_upsert_bot_channels(
  _token text,
  _bot_id uuid,
  _guild_id text,
  _channels jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tok RECORD;
  _user_id uuid;
  _ch jsonb;
  _inserted integer := 0;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_bot_mismatch');
  END IF;

  SELECT user_id INTO _user_id FROM public.bot_orders WHERE id = _bot_id;
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bot_not_found');
  END IF;

  DELETE FROM public.bot_channel_cache
  WHERE bot_id = _bot_id AND guild_id = _guild_id;

  IF _channels IS NOT NULL AND jsonb_typeof(_channels) = 'array' THEN
    FOR _ch IN SELECT * FROM jsonb_array_elements(_channels) LOOP
      INSERT INTO public.bot_channel_cache (
        bot_id, user_id, guild_id, channel_id, channel_name,
        channel_type, parent_id, parent_name, position
      )
      VALUES (
        _bot_id,
        _user_id,
        _guild_id,
        _ch->>'channel_id',
        _ch->>'channel_name',
        COALESCE(_ch->>'channel_type', 'text'),
        _ch->>'parent_id',
        _ch->>'parent_name',
        COALESCE((_ch->>'position')::int, 0)
      );
      _inserted := _inserted + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true, 'inserted', _inserted);
END;
$$;

-- Same bug almost certainly exists for replace_bot_guilds; rewrite it the
-- same way so the "Refresh" button on the server selector also works.
CREATE OR REPLACE FUNCTION public.runtime_replace_bot_guilds(
  _token text,
  _bot_id uuid,
  _guilds jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tok RECORD;
  _user_id uuid;
  _g jsonb;
  _ids text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_bot_mismatch');
  END IF;

  SELECT user_id INTO _user_id FROM public.bot_orders WHERE id = _bot_id;
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bot_not_found');
  END IF;

  IF _guilds IS NOT NULL AND jsonb_typeof(_guilds) = 'array' THEN
    FOR _g IN SELECT * FROM jsonb_array_elements(_guilds) LOOP
      INSERT INTO public.bot_active_guilds (bot_id, user_id, guild_id, guild_name, member_count)
      VALUES (
        _bot_id,
        _user_id,
        _g->>'guild_id',
        _g->>'guild_name',
        NULLIF(_g->>'member_count','')::int
      )
      ON CONFLICT (bot_id, guild_id) DO UPDATE SET
        guild_name = EXCLUDED.guild_name,
        member_count = EXCLUDED.member_count,
        updated_at = now();
      _ids := array_append(_ids, _g->>'guild_id');
    END LOOP;
  END IF;

  -- Remove guilds the bot is no longer in
  DELETE FROM public.bot_active_guilds
  WHERE bot_id = _bot_id
    AND guild_id <> ALL (_ids);

  RETURN jsonb_build_object('ok', true, 'count', array_length(_ids, 1));
END;
$$;