-- Accept a team invite by its unique token. Lets us authenticate the
-- invitee to a specific invite row even when the signing-in user's email
-- differs from the email the invite was originally sent to (e.g. they
-- signed up with a different alias).
CREATE OR REPLACE FUNCTION public.team_accept_invite_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.dashboard_team%ROWTYPE;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF _token IS NULL OR length(_token) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing token');
  END IF;

  SELECT * INTO _row FROM public.dashboard_team WHERE invite_token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid token');
  END IF;

  -- Owner can't accept their own invite as a member
  IF _row.owner_user_id = _uid THEN
    RETURN jsonb_build_object('ok', true, 'owner_user_id', _row.owner_user_id, 'already', true);
  END IF;

  UPDATE public.dashboard_team
     SET member_user_id = _uid,
         accepted_at = COALESCE(accepted_at, now())
   WHERE id = _row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'owner_user_id', _row.owner_user_id,
    'role', _row.role
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_accept_invite_by_token(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.team_accept_invite_by_token(text) TO authenticated;
