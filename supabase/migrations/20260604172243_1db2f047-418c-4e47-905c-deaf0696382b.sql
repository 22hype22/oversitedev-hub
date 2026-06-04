CREATE OR REPLACE FUNCTION public.runtime_award_user_xp(
  _token text,
  _bot_id uuid,
  _guild_id text,
  _user_id text,
  _xp_amount integer DEFAULT 15
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tok RECORD;
  _xp integer;
  _level integer;
  _old_level integer;
  _needed integer;
  _leveled boolean := false;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN RAISE EXCEPTION 'token_bot_mismatch'; END IF;
  IF _xp_amount IS NULL OR _xp_amount <= 0 THEN _xp_amount := 15; END IF;

  INSERT INTO public.user_xp (bot_id, guild_id, user_id, xp, level, updated_at)
  VALUES (_bot_id, _guild_id, _user_id, _xp_amount, 0, now())
  ON CONFLICT (bot_id, guild_id, user_id) DO UPDATE
    SET xp = public.user_xp.xp + EXCLUDED.xp,
        updated_at = now()
  RETURNING xp, level INTO _xp, _level;

  _old_level := _level;

  LOOP
    _needed := (_level + 1) * 100;
    EXIT WHEN _xp < _needed;
    _xp := _xp - _needed;
    _level := _level + 1;
    _leveled := true;
  END LOOP;

  IF _leveled THEN
    UPDATE public.user_xp
       SET xp = _xp, level = _level, updated_at = now()
     WHERE bot_id = _bot_id AND guild_id = _guild_id AND user_id = _user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'xp', _xp,
    'level', _level,
    'new_level', _level,
    'old_level', _old_level,
    'leveled_up', _leveled,
    'xp_needed', (_level + 1) * 100
  );
END;
$$;