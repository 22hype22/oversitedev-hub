# Team Management hub

Replace `SupportAccessManager` mount in `BotDashboard.tsx` with a new `TeamManagementHub` containing 3 tabs: **Team Members**, **Roles**, **Support Access**.

## Database (migration)

### `dashboard_team`
- `id uuid pk`
- `owner_user_id uuid` (account owner)
- `member_email text` (lowercased)
- `member_user_id uuid null` (filled when invite accepted / matched)
- `role text` — one of `owner | co_owner | admin | moderator | viewer`
- `invite_token text unique null` (random token for invite link)
- `invited_at timestamptz default now()`
- `accepted_at timestamptz null`
- `invited_by uuid null`
- `created_at`, `updated_at`
- Unique on `(owner_user_id, lower(member_email))`

RLS:
- Owner: full CRUD where `owner_user_id = auth.uid()` (except cannot delete/edit a row where `role='owner'`).
- Member: SELECT where `lower(member_email) = lower(auth.jwt()->>'email')`.

Trigger: ensure exactly one `owner` row per `owner_user_id`. Auto-insert an `owner` row when a user first opens the hub (RPC `ensure_team_owner_row()`).

Trigger on signup / on first SELECT: if `member_user_id IS NULL` and an auth user with matching email exists, fill it and set `accepted_at`. Implemented via SECURITY DEFINER function `accept_pending_team_invites()` called from the hook.

### `dashboard_role_permissions`
- `owner_user_id uuid`
- `role text`
- `permissions jsonb` — `{ view_dashboard, edit_bot_config, manage_secrets, view_logs, edit_billing, manage_team, transfer_ownership }`
- PK `(owner_user_id, role)`

Defaults (used when no row exists):
| role | view | edit_config | secrets | logs | billing | team | transfer |
|------|------|-------------|---------|------|---------|------|----------|
| owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| co_owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |   |
| admin | ✓ | ✓ | ✓ | ✓ |   |   |   |
| moderator | ✓ | ✓ |   | ✓ |   |   |   |
| viewer | ✓ |   |   |   |   |   |   |

RLS: owner manages their rows; everyone authenticated can read their owner's row (via membership).

### RPCs (SECURITY DEFINER)
- `team_invite_member(email, role)` — owner-only; inserts row with `invite_token`.
- `team_remove_member(member_id)` — owner-only; cannot remove `owner` row.
- `team_update_member_role(member_id, role)` — owner-only.
- `team_transfer_ownership(member_id)` — owner-only; swaps roles atomically.
- `team_accept_invites_for_current_user()` — called on hub load; matches by email.
- `team_get_effective_role(owner_user_id)` — returns role + permissions for current user.

## Frontend

### New files
- `src/components/dashboard/team/TeamManagementHub.tsx` — Card with Tabs.
- `src/components/dashboard/team/TeamMembersTab.tsx` — table + invite dialog + per-row role select + transfer button.
- `src/components/dashboard/team/RolesTab.tsx` — permission matrix; owner can toggle checkboxes.
- `src/components/dashboard/team/SupportAccessTab.tsx` — thin wrapper rendering existing `SupportAccessManager` body.
- `src/hooks/useTeamRole.tsx` — returns `{ role, permissions, isOwner }` for current user against current owner (defaults to own account).
- `src/components/dashboard/team/RoleGate.tsx` — `<RoleGate permission="edit_bot_config" fallback={...}>`.

### Edits
- `src/pages/BotDashboard.tsx` — swap `<SupportAccessManager />` for `<TeamManagementHub />`.
- `src/components/dashboard/AddonConfigCard.tsx` — disable Save when `!permissions.edit_bot_config`; show "Viewer — read only" hint.

### Email
Invite email via Lovable transactional email is out of scope for this pass — the invite row is created with a token and a copyable link the owner can send manually. (Note for follow-up.)

## Out of scope this turn
- Cross-owner dashboard viewing (member logs in and sees owner's bots) — schema supports it but UI switcher is a separate task.
- Sending invite emails automatically.
- Gating every page beyond the addon Save button (billing buttons can be wired in a follow-up).
