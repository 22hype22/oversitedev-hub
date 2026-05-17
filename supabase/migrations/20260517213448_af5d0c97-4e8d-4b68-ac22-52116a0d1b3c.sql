
REVOKE EXECUTE ON FUNCTION public.ensure_team_owner_row() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.team_accept_invites_for_current_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.team_invite_member(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.team_remove_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.team_update_member_role(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.team_transfer_ownership(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.team_get_effective_role(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.team_set_role_permissions(text, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_team_owner_row() TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_accept_invites_for_current_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_invite_member(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_remove_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_update_member_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_transfer_ownership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_get_effective_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_set_role_permissions(text, jsonb) TO authenticated;
