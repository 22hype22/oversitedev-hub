CREATE OR REPLACE FUNCTION public.runtime_music_op(p_token text, p_op text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tok RECORD;
  _bot_id uuid;
  _result jsonb;
  _row jsonb;
BEGIN
  -- Reuse the same worker-token validator used by every other runtime_* RPC.
  SELECT * INTO _tok FROM public._worker_token_lookup(p_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  _bot_id := _tok.bot_id;

  IF p_op IN (
    'like_add','like_remove','likes_clear','likes_list',
    'taste_save','taste_load',
    'resume_save','resume_load','resume_delete',
    'xp_load','xp_save'
  ) AND _bot_id IS NULL THEN
    RAISE EXCEPTION 'token_not_bound_to_bot';
  END IF;

  IF p_op = 'like_add' THEN
    INSERT INTO public.liked_songs (bot_id, user_id, track_title)
    VALUES (_bot_id, p_payload->>'user_id', p_payload->>'track_title')
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('ok', true);

  ELSIF p_op = 'like_remove' THEN
    DELETE FROM public.liked_songs
     WHERE bot_id = _bot_id
       AND user_id = p_payload->>'user_id'
       AND track_title = p_payload->>'track_title';
    RETURN jsonb_build_object('ok', true);

  ELSIF p_op = 'likes_clear' THEN
    DELETE FROM public.liked_songs
     WHERE bot_id = _bot_id
       AND user_id = p_payload->>'user_id';
    RETURN jsonb_build_object('ok', true);

  ELSIF p_op = 'likes_list' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(l)), '[]'::jsonb) INTO _result
      FROM public.liked_songs l WHERE l.bot_id = _bot_id;
    RETURN jsonb_build_object('ok', true, 'rows', _result);

  ELSIF p_op = 'taste_save' THEN
    INSERT INTO public.music_taste (bot_id, guild_id, scores, updated_at)
    VALUES (_bot_id, p_payload->>'guild_id', COALESCE(p_payload->'scores','{}'::jsonb), now())
    ON CONFLICT (bot_id, guild_id) DO UPDATE
      SET scores = EXCLUDED.scores, updated_at = now();
    RETURN jsonb_build_object('ok', true);

  ELSIF p_op = 'taste_load' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO _result
      FROM public.music_taste t WHERE t.bot_id = _bot_id;
    RETURN jsonb_build_object('ok', true, 'rows', _result);

  ELSIF p_op = 'resume_save' THEN
    INSERT INTO public.music_resume (
      bot_id, guild_id, channel_id, track_uri, track_title, position_ms, genre, updated_at
    )
    VALUES (
      _bot_id,
      p_payload->>'guild_id',
      p_payload->>'channel_id',
      p_payload->>'track_uri',
      p_payload->>'track_title',
      COALESCE((p_payload->>'position_ms')::bigint, 0),
      p_payload->>'genre',
      now()
    )
    ON CONFLICT (bot_id, guild_id) DO UPDATE
      SET channel_id = EXCLUDED.channel_id,
          track_uri = EXCLUDED.track_uri,
          track_title = EXCLUDED.track_title,
          position_ms = EXCLUDED.position_ms,
          genre = EXCLUDED.genre,
          updated_at = now();
    RETURN jsonb_build_object('ok', true);

  ELSIF p_op = 'resume_load' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO _result
      FROM public.music_resume r WHERE r.bot_id = _bot_id;
    RETURN jsonb_build_object('ok', true, 'rows', _result);

  ELSIF p_op = 'resume_delete' THEN
    DELETE FROM public.music_resume
     WHERE bot_id = _bot_id AND guild_id = p_payload->>'guild_id';
    RETURN jsonb_build_object('ok', true);

  ELSIF p_op = 'bridge_upsert' THEN
    INSERT INTO public.music_bridge (guild_id, channel_id, status, requested_by, updated_at)
    VALUES (
      p_payload->>'guild_id',
      p_payload->>'channel_id',
      COALESCE(p_payload->>'status', 'hold'),
      p_payload->>'requested_by',
      now()
    )
    ON CONFLICT (guild_id) DO UPDATE
      SET channel_id = EXCLUDED.channel_id,
          status = EXCLUDED.status,
          requested_by = EXCLUDED.requested_by,
          updated_at = now();
    RETURN jsonb_build_object('ok', true);

  ELSIF p_op = 'bridge_list' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(b)), '[]'::jsonb) INTO _result
      FROM public.music_bridge b;
    RETURN jsonb_build_object('ok', true, 'rows', _result);

  ELSIF p_op = 'bridge_delete' THEN
    DELETE FROM public.music_bridge WHERE guild_id = p_payload->>'guild_id';
    RETURN jsonb_build_object('ok', true);

  ELSIF p_op = 'xp_load' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO _result
      FROM public.user_xp x
     WHERE x.bot_id = _bot_id AND x.guild_id = p_payload->>'guild_id';
    RETURN jsonb_build_object('ok', true, 'rows', _result);

  ELSIF p_op = 'xp_save' THEN
    FOR _row IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'rows', '[]'::jsonb))
    LOOP
      INSERT INTO public.user_xp (bot_id, guild_id, user_id, xp, level, updated_at)
      VALUES (
        _bot_id,
        p_payload->>'guild_id',
        _row->>'user_id',
        COALESCE((_row->>'xp')::integer, 0),
        COALESCE((_row->>'level')::integer, 0),
        now()
      )
      ON CONFLICT (bot_id, guild_id, user_id) DO UPDATE
        SET xp = EXCLUDED.xp,
            level = EXCLUDED.level,
            updated_at = now();
    END LOOP;
    RETURN jsonb_build_object('ok', true);

  ELSE
    RAISE EXCEPTION 'unknown_op: %', p_op;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.runtime_music_op(text, text, jsonb) TO anon, authenticated, service_role;