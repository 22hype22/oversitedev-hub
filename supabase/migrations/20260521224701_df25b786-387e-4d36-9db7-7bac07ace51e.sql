
-- Invite a member to EVERY bot owned by the caller, using a single shared invite token.
CREATE OR REPLACE FUNCTION public.team_invite_member_all_owner_bots(_email text, _role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token text;
  _matched_user uuid;
  _normalized text := lower(trim(_email));
  _uid uuid := auth.uid();
  _bot record;
  _first_id uuid;
  _bot_count int := 0;
  _existing_token text;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF _normalized = '' OR _normalized !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid email');
  END IF;
  IF _role NOT IN ('co_owner','admin','moderator','viewer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid role');
  END IF;

  -- Reuse a single token across all bots so the invite link works no matter
  -- which row the lookup hits. Prefer any existing pending token for this
  -- member under this owner, otherwise generate a fresh one.
  SELECT invite_token INTO _existing_token
    FROM public.dashboard_team
   WHERE owner_user_id = _uid
     AND lower(member_email) = _normalized
     AND invite_token IS NOT NULL
   LIMIT 1;
  _token := COALESCE(_existing_token,
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

  SELECT id INTO _matched_user FROM auth.users WHERE lower(email) = _normalized LIMIT 1;

  FOR _bot IN
    SELECT id FROM public.bot_orders WHERE user_id = _uid
  LOOP
    INSERT INTO public.dashboard_team (
      owner_user_id, member_email, member_user_id, role,
      invite_token, invited_by, accepted_at, bot_id
    ) VALUES (
      _uid, _normalized, _matched_user, _role,
      _token, _uid,
      CASE WHEN _matched_user IS NOT NULL THEN now() ELSE NULL END,
      _bot.id
    )
    ON CONFLICT (bot_id, lower(member_email)) DO UPDATE
      SET role = EXCLUDED.role,
          invite_token = COALESCE(public.dashboard_team.invite_token, EXCLUDED.invite_token),
          member_user_id = COALESCE(public.dashboard_team.member_user_id, EXCLUDED.member_user_id),
          invited_at = now()
    RETURNING id INTO _first_id;
    _bot_count := _bot_count + 1;
  END LOOP;

  IF _bot_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no bots to invite to');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', _first_id, 'invite_token', _token, 'bot_count', _bot_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_invite_member_all_owner_bots(text, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.team_invite_member_all_owner_bots(text, text) TO authenticated;

-- Update a member's role on EVERY bot owned by the caller (matched by email).
CREATE OR REPLACE FUNCTION public.team_update_member_role_by_email(_email text, _role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _normalized text := lower(trim(_email));
  _updated int;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF _role NOT IN ('co_owner','admin','moderator','viewer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid role');
  END IF;
  UPDATE public.dashboard_team
     SET role = _role,
         updated_at = now()
   WHERE owner_user_id = _uid
     AND lower(member_email) = _normalized
     AND role <> 'owner';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', _updated);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_update_member_role_by_email(text, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.team_update_member_role_by_email(text, text) TO authenticated;

-- Remove a member from EVERY bot owned by the caller (matched by email).
CREATE OR REPLACE FUNCTION public.team_remove_member_by_email(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _normalized text := lower(trim(_email));
  _deleted int;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  DELETE FROM public.dashboard_team
   WHERE owner_user_id = _uid
     AND lower(member_email) = _normalized
     AND role <> 'owner';
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted', _deleted);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_remove_member_by_email(text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.team_remove_member_by_email(text) TO authenticated;
