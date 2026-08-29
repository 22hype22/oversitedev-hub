-- Team access by Discord member / Discord role / Roblox group rank, in addition
-- to the existing email invites. Owners define "grants"; an edge function
-- (team-access-resolve) evaluates a signed-in person against them and MATERIALIZES
-- normal dashboard_team rows, so all existing per-bot RLS
-- (has_bot_team_access / has_bot_team_perm) keeps enforcing access unchanged.
--
-- Fail-closed by design: a grant only ever ADDS access on a positive identity
-- match; the resolver removes the rows it created once a match no longer holds.

create table if not exists public.dashboard_access_grants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  -- Which bots this grant covers. NULL = every bot the owner has; otherwise the
  -- bots whose bot_orders.group_id matches this group.
  group_id uuid,
  kind text not null check (kind in ('discord_member','discord_role','roblox_group_rank')),
  -- discord_member -> discord user id; discord_role -> discord role id
  discord_id text,
  -- guild the discord_member/discord_role check runs against (optional; the
  -- resolver falls back to the bot's active guild when blank)
  guild_id text,
  -- roblox_group_rank
  roblox_group_id text,
  roblox_min_rank integer,
  -- team role granted to anyone who matches
  role text not null check (role in ('co_owner','admin','moderator','viewer')),
  label text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists dashboard_access_grants_owner_idx
  on public.dashboard_access_grants (owner_user_id);
create index if not exists dashboard_access_grants_kind_idx
  on public.dashboard_access_grants (kind);

alter table public.dashboard_access_grants enable row level security;

-- Owners manage only their own grants.
drop policy if exists "Owner manages access grants" on public.dashboard_access_grants;
create policy "Owner manages access grants"
  on public.dashboard_access_grants for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

grant select, insert, update, delete on public.dashboard_access_grants to authenticated;

-- Tag the dashboard_team rows the resolver creates, so it can manage ONLY those
-- and never touches real email invites. NULL on every human-created row.
alter table public.dashboard_team
  add column if not exists access_grant_id uuid;

notify pgrst, 'reload schema';
