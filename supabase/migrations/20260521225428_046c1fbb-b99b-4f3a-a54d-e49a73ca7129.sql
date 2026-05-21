CREATE OR REPLACE FUNCTION public.team_leave_bot(_bot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _deleted int;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF _bot_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bot_id required');
  END IF;
  DELETE FROM public.dashboard_team
   WHERE bot_id = _bot_id
     AND member_user_id = _uid
     AND role <> 'owner';
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  IF _deleted = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not a team member of this bot');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_leave_bot(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.team_leave_bot(uuid) TO authenticated;