-- ============================================================
-- 1. bot_channel_cache table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_channel_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  user_id uuid NOT NULL,
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  channel_name text NOT NULL,
  channel_type text NOT NULL DEFAULT 'text',
  parent_id text,
  parent_name text,
  position integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, guild_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_channel_cache_bot_guild
  ON public.bot_channel_cache (bot_id, guild_id, position);

ALTER TABLE public.bot_channel_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own channel cache"
  ON public.bot_channel_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all channel cache"
  ON public.bot_channel_cache FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Support view channel cache"
  ON public.bot_channel_cache FOR SELECT
  TO authenticated
  USING (has_support_access(auth.uid(), user_id));

CREATE POLICY "Service role manages channel cache"
  ON public.bot_channel_cache FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 2. Extend bot_commands action enum to include 'list_channels'
-- ============================================================
ALTER TABLE public.bot_commands
  DROP CONSTRAINT IF EXISTS bot_commands_action_check;

ALTER TABLE public.bot_commands
  ADD CONSTRAINT bot_commands_action_check
  CHECK (action = ANY (ARRAY[
    'start'::text, 'stop'::text, 'restart'::text, 'update'::text,
    'list_channels'::text
  ]));

-- Add an optional payload column so list_channels can carry the guild_id
ALTER TABLE public.bot_commands
  ADD COLUMN IF NOT EXISTS payload jsonb;

-- ============================================================
-- 3. request_list_channels — owner-callable RPC to queue a refresh
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_list_channels(
  _bot_id uuid,
  _guild_id text
)
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
  -- Verify caller owns this bot
  SELECT user_id INTO _user_id
  FROM public.bot_orders
  WHERE id = _bot_id AND user_id = auth.uid();

  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  -- De-dupe: if there's already a pending/claimed list_channels command
  -- for this guild within the last minute, return that one.
  SELECT id INTO _existing
  FROM public.bot_commands
  WHERE bot_id = _bot_id
    AND action = 'list_channels'
    AND status IN ('pending', 'claimed')
    AND payload->>'guild_id' = _guild_id
    AND created_at > now() - interval '1 minute'
  ORDER BY created_at DESC
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'command_id', _existing, 'deduped', true);
  END IF;

  INSERT INTO public.bot_commands (
    bot_id, user_id, requested_by, action, status, payload
  )
  VALUES (
    _bot_id, _user_id, auth.uid(), 'list_channels', 'pending',
    jsonb_build_object('guild_id', _guild_id)
  )
  RETURNING id INTO _command_id;

  RETURN jsonb_build_object('ok', true, 'command_id', _command_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_list_channels(uuid, text) TO authenticated;

-- ============================================================
-- 4. runtime_upsert_bot_channels — worker-callable RPC to replace cache
-- ============================================================
CREATE OR REPLACE FUNCTION public.runtime_upsert_bot_channels(
  _token text,
  _bot_id uuid,
  _guild_id text,
  _channels jsonb  -- array of {channel_id, channel_name, channel_type, parent_id, parent_name, position}
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _ch jsonb;
  _inserted integer := 0;
BEGIN
  -- Validate worker token
  IF NOT EXISTS (
    SELECT 1 FROM public.worker_tokens
    WHERE token_hash = encode(digest(_token, 'sha256'), 'hex')
      AND (revoked_at IS NULL)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  -- Resolve owner
  SELECT user_id INTO _user_id FROM public.bot_orders WHERE id = _bot_id;
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bot_not_found');
  END IF;

  -- Replace strategy: delete this guild's cache, then re-insert
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

REVOKE ALL ON FUNCTION public.runtime_upsert_bot_channels(text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.runtime_upsert_bot_channels(text, uuid, text, jsonb) TO service_role;