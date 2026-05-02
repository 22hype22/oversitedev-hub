
-- Role cache table
CREATE TABLE IF NOT EXISTS public.bot_role_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  user_id uuid NOT NULL,
  guild_id text NOT NULL,
  role_id text NOT NULL,
  role_name text NOT NULL,
  color integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  managed boolean NOT NULL DEFAULT false,
  is_everyone boolean NOT NULL DEFAULT false,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, guild_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_role_cache_bot_guild
  ON public.bot_role_cache (bot_id, guild_id, position DESC);

ALTER TABLE public.bot_role_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own role cache"
  ON public.bot_role_cache FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all role cache"
  ON public.bot_role_cache FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Support view role cache"
  ON public.bot_role_cache FOR SELECT TO authenticated
  USING (has_support_access(auth.uid(), user_id));

CREATE POLICY "Service role manages role cache"
  ON public.bot_role_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Extend command action enum to include list_roles
ALTER TABLE public.bot_commands DROP CONSTRAINT IF EXISTS bot_commands_action_check;
ALTER TABLE public.bot_commands ADD CONSTRAINT bot_commands_action_check
  CHECK (action = ANY (ARRAY[
    'start'::text, 'stop'::text, 'restart'::text, 'update'::text,
    'list_channels'::text, 'list_guilds'::text, 'list_roles'::text
  ]));

-- Owner-callable RPC to queue a role refresh
CREATE OR REPLACE FUNCTION public.request_list_roles(_bot_id uuid, _guild_id text)
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
  SELECT user_id INTO _user_id FROM public.bot_orders
   WHERE id = _bot_id AND user_id = auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  SELECT id INTO _existing FROM public.bot_commands
   WHERE bot_id = _bot_id AND action = 'list_roles'
     AND status IN ('pending', 'claimed')
     AND payload->>'guild_id' = _guild_id
     AND created_at > now() - interval '1 minute'
   ORDER BY created_at DESC LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'command_id', _existing, 'deduped', true);
  END IF;

  INSERT INTO public.bot_commands (bot_id, user_id, requested_by, action, status, payload)
  VALUES (_bot_id, _user_id, auth.uid(), 'list_roles', 'pending',
          jsonb_build_object('guild_id', _guild_id))
  RETURNING id INTO _command_id;

  RETURN jsonb_build_object('ok', true, 'command_id', _command_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_list_roles(uuid, text) TO authenticated;

-- Worker-callable RPC to replace cached roles for a guild
CREATE OR REPLACE FUNCTION public.runtime_upsert_bot_roles(
  _token text, _bot_id uuid, _guild_id text, _roles jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _r jsonb;
  _inserted integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.worker_tokens
    WHERE token_hash = encode(digest(_token, 'sha256'), 'hex')
      AND revoked_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT user_id INTO _user_id FROM public.bot_orders WHERE id = _bot_id;
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bot_not_found');
  END IF;

  DELETE FROM public.bot_role_cache WHERE bot_id = _bot_id AND guild_id = _guild_id;

  IF _roles IS NOT NULL AND jsonb_typeof(_roles) = 'array' THEN
    FOR _r IN SELECT * FROM jsonb_array_elements(_roles) LOOP
      INSERT INTO public.bot_role_cache (
        bot_id, user_id, guild_id, role_id, role_name,
        color, position, managed, is_everyone
      ) VALUES (
        _bot_id, _user_id, _guild_id,
        _r->>'role_id',
        _r->>'role_name',
        COALESCE((_r->>'color')::int, 0),
        COALESCE((_r->>'position')::int, 0),
        COALESCE((_r->>'managed')::boolean, false),
        COALESCE((_r->>'is_everyone')::boolean, false)
      );
      _inserted := _inserted + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true, 'inserted', _inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.runtime_upsert_bot_roles(text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.runtime_upsert_bot_roles(text, uuid, text, jsonb) TO service_role;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_role_cache;
