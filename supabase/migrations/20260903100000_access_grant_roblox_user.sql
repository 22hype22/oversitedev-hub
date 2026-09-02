-- Invite a specific Roblox user by username: a new dashboard_access_grants kind.
-- The dashboard resolves the typed username to a Roblox user id (via the
-- team-identity-lookup function) and stores the id; the resolver grants access
-- to whichever signed-in account has that Roblox id linked through verification.
-- Fail-closed like every other kind: no positive id match, no access.

alter table public.dashboard_access_grants
  add column if not exists roblox_user_id text;

alter table public.dashboard_access_grants
  drop constraint if exists dashboard_access_grants_kind_check;

alter table public.dashboard_access_grants
  add constraint dashboard_access_grants_kind_check
  check (kind in ('discord_member','discord_role','roblox_group_rank','roblox_user'));

notify pgrst, 'reload schema';
