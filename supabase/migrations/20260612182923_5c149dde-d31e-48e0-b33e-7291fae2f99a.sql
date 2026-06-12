
-- Post system tables
CREATE TABLE public.post_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bot_orders(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  name text NOT NULL,
  description text,
  target_channel_id text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX post_types_bot_guild_idx ON public.post_types(bot_id, guild_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_types TO authenticated;
GRANT ALL ON public.post_types TO service_role;

ALTER TABLE public.post_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage post_types"
  ON public.post_types
  FOR ALL
  TO authenticated
  USING (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()))
  WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

CREATE POLICY "Team manages post_types"
  ON public.post_types
  FOR ALL
  TO authenticated
  USING (public.has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'))
  WITH CHECK (public.has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'));

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bot_orders(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  post_type_id uuid REFERENCES public.post_types(id) ON DELETE SET NULL,
  author_id text NOT NULL,
  channel_id text,
  message_id text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX posts_bot_guild_author_idx ON public.posts(bot_id, guild_id, author_id, created_at DESC);

GRANT ALL ON public.posts TO service_role;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
-- No authenticated/anon policies — bot-only access via RPC

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER post_types_touch BEFORE UPDATE ON public.post_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER posts_touch BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Worker RPC
CREATE OR REPLACE FUNCTION public.runtime_post_op(p_token text, p_op text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _tok RECORD;
  _bot_id uuid;
  _result jsonb;
  _row jsonb;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(p_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  _bot_id := _tok.bot_id;
  IF _bot_id IS NULL THEN
    RAISE EXCEPTION 'token_not_bound_to_bot';
  END IF;

  IF p_op = 'types_list' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at), '[]'::jsonb) INTO _result
      FROM public.post_types t
     WHERE t.bot_id = _bot_id
       AND t.guild_id = p_payload->>'guild_id';
    RETURN jsonb_build_object('ok', true, 'rows', _result);

  ELSIF p_op = 'post_create' THEN
    INSERT INTO public.posts (bot_id, guild_id, post_type_id, author_id, channel_id, message_id, content)
    VALUES (
      _bot_id,
      p_payload->>'guild_id',
      NULLIF(p_payload->>'post_type_id','')::uuid,
      p_payload->>'author_id',
      p_payload->>'channel_id',
      p_payload->>'message_id',
      COALESCE(p_payload->'content', '{}'::jsonb)
    )
    RETURNING to_jsonb(posts.*) INTO _row;
    RETURN jsonb_build_object('ok', true, 'row', _row);

  ELSIF p_op = 'post_list' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'bot_id', p.bot_id,
      'guild_id', p.guild_id,
      'post_type_id', p.post_type_id,
      'type_name', t.name,
      'author_id', p.author_id,
      'channel_id', p.channel_id,
      'message_id', p.message_id,
      'content', p.content,
      'created_at', p.created_at,
      'updated_at', p.updated_at
    ) ORDER BY p.created_at DESC), '[]'::jsonb) INTO _result
    FROM (
      SELECT * FROM public.posts
       WHERE bot_id = _bot_id
         AND guild_id = p_payload->>'guild_id'
         AND author_id = p_payload->>'author_id'
       ORDER BY created_at DESC
       LIMIT 25
    ) p
    LEFT JOIN public.post_types t ON t.id = p.post_type_id;
    RETURN jsonb_build_object('ok', true, 'rows', _result);

  ELSIF p_op = 'post_get' THEN
    SELECT to_jsonb(p.*) INTO _row
      FROM public.posts p
     WHERE p.id = (p_payload->>'post_id')::uuid
       AND p.bot_id = _bot_id;
    RETURN jsonb_build_object('ok', true, 'row', COALESCE(_row, 'null'::jsonb));

  ELSIF p_op = 'post_update' THEN
    UPDATE public.posts
       SET content = COALESCE(p_payload->'content', content),
           message_id = COALESCE(p_payload->>'message_id', message_id),
           updated_at = now()
     WHERE id = (p_payload->>'post_id')::uuid
       AND bot_id = _bot_id
    RETURNING to_jsonb(posts.*) INTO _row;
    RETURN jsonb_build_object('ok', true, 'row', COALESCE(_row, 'null'::jsonb));

  ELSIF p_op = 'post_delete' THEN
    DELETE FROM public.posts
     WHERE id = (p_payload->>'post_id')::uuid
       AND bot_id = _bot_id;
    RETURN jsonb_build_object('ok', true);

  ELSE
    RAISE EXCEPTION 'unknown_op: %', p_op;
  END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.runtime_post_op(text, text, jsonb) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
