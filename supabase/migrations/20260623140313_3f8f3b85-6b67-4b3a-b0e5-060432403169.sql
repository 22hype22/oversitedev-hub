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
    -- Edit view: return ALL posts for this bot+guild, regardless of author.
    -- Anyone with dashboard access to the bot should see every post.
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
       ORDER BY created_at DESC
       LIMIT 100
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