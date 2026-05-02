-- ============================================================
-- 1. Extend bot_commands.action to allow 'list_guilds'
-- ============================================================
ALTER TABLE public.bot_commands
  DROP CONSTRAINT IF EXISTS bot_commands_action_check;

ALTER TABLE public.bot_commands
  ADD CONSTRAINT bot_commands_action_check
  CHECK (action = ANY (ARRAY[
    'start'::text, 'stop'::text, 'restart'::text, 'update'::text,
    'list_channels'::text, 'list_guilds'::text
  ]));

-- ============================================================
-- 2. request_list_guilds — owner-callable RPC to queue a guild refresh
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_list_guilds(_bot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _existing uuid;
  _command_id uuid;
BEGIN
  -- Verify caller owns this bot (or has support access)
  SELECT user_id INTO _user_id
  FROM public.bot_orders
  WHERE id = _bot_id
    AND (user_id = auth.uid() OR has_support_access(auth.uid(), user_id));

  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  -- De-dupe: if there's already a pending/claimed list_guilds command
  -- within the last minute, return that one.
  SELECT id INTO _existing
  FROM public.bot_commands
  WHERE bot_id = _bot_id
    AND action = 'list_guilds'
    AND status IN ('pending', 'claimed')
    AND created_at > now() - interval '1 minute'
  ORDER BY created_at DESC
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'command_id', _existing, 'deduped', true);
  END IF;

  INSERT INTO public.bot_commands (
    bot_id, user_id, requested_by, action, status
  )
  VALUES (
    _bot_id, _user_id, auth.uid(), 'list_guilds', 'pending'
  )
  RETURNING id INTO _command_id;

  RETURN jsonb_build_object('ok', true, 'command_id', _command_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_list_guilds(uuid) TO authenticated;

-- ============================================================
-- 3. runtime_replace_bot_guilds — worker-callable: full replace
--    Deletes guild rows the bot is no longer in, then upserts current ones.
-- ============================================================
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
  _user_id uuid;
  _ids text[];
  _g jsonb;
  _count int := 0;
BEGIN
  -- Verify worker token
  IF NOT EXISTS (
    SELECT 1 FROM public.worker_tokens
    WHERE token = _token AND revoked_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT user_id INTO _user_id
  FROM public.bot_orders WHERE id = _bot_id;

  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bot_not_found');
  END IF;

  -- Collect incoming guild_ids
  SELECT COALESCE(array_agg(g->>'guild_id'), ARRAY[]::text[]) INTO _ids
  FROM jsonb_array_elements(_guilds) g;

  -- Remove guilds the bot is no longer in
  DELETE FROM public.bot_active_guilds
  WHERE bot_id = _bot_id
    AND guild_id <> ALL (_ids);

  -- Upsert each guild
  FOR _g IN SELECT * FROM jsonb_array_elements(_guilds) LOOP
    INSERT INTO public.bot_active_guilds (
      bot_id, user_id, guild_id, guild_name, member_count, last_seen_at
    )
    VALUES (
      _bot_id,
      _user_id,
      _g->>'guild_id',
      NULLIF(_g->>'guild_name', ''),
      NULLIF(_g->>'member_count', '')::int,
      now()
    )
    ON CONFLICT (bot_id, guild_id) DO UPDATE
      SET guild_name = EXCLUDED.guild_name,
          member_count = EXCLUDED.member_count,
          last_seen_at = now();
    _count := _count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'count', _count);
END;
$$;

REVOKE ALL ON FUNCTION public.runtime_replace_bot_guilds(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.runtime_replace_bot_guilds(text, uuid, jsonb) TO service_role;