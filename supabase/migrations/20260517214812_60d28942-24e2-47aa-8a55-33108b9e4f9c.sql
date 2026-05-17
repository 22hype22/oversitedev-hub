CREATE OR REPLACE FUNCTION public.team_invite_member(_email text, _role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _token text;
  _id uuid;
  _matched_user uuid;
  _normalized text := lower(trim(_email));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF _normalized = '' OR _normalized !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid email');
  END IF;
  IF _role NOT IN ('co_owner','admin','moderator','viewer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid role');
  END IF;

  _token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  SELECT id INTO _matched_user FROM auth.users WHERE lower(email) = _normalized LIMIT 1;

  INSERT INTO public.dashboard_team (owner_user_id, member_email, member_user_id, role, invite_token, invited_by, accepted_at)
  VALUES (auth.uid(), _normalized, _matched_user, _role, _token, auth.uid(),
          CASE WHEN _matched_user IS NOT NULL THEN now() ELSE NULL END)
  ON CONFLICT (owner_user_id, lower(member_email)) DO UPDATE
    SET role = EXCLUDED.role,
        invite_token = COALESCE(public.dashboard_team.invite_token, EXCLUDED.invite_token),
        member_user_id = COALESCE(public.dashboard_team.member_user_id, EXCLUDED.member_user_id),
        invited_at = now()
  RETURNING id, invite_token INTO _id, _token;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'invite_token', _token);
END;
$function$;