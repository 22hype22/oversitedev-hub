# Per-Bot Team Membership

Shift team access from per-owner ("you're on my team = you see all my bots") to per-bot ("you're invited to *this* bot"). Existing memberships are preserved so no one loses access.

## Outcome

- A new bot starts with **only its owner**. No team members, no other accounts.
- Owner explicitly invites team members **to a specific bot** (or multiple bots) from that bot's Team tab.
- Existing teams keep working: every current member is backfilled into every bot the owner has *today*. Only future bots start empty.
- Admins keep global access via `has_role('admin')` — that's a separate platform role, not a team membership.

## Database changes

1. **`dashboard_team` becomes per-bot**
   - Add `bot_id uuid NOT NULL` (after backfill).
   - Drop old unique index `(owner_user_id, lower(member_email))`, add `(bot_id, lower(member_email))`.
   - Backfill: for each existing `dashboard_team` row, insert one row per existing `bot_orders.id` owned by `owner_user_id`. Delete the original "global" rows.
   - Invite/transfer tokens, role, permissions stay on the row (per bot).

2. **New SECURITY DEFINER helpers** (replace owner-scoped ones):
   - `has_bot_team_access(_viewer uuid, _bot_id uuid) returns boolean`
   - `has_bot_team_perm(_viewer uuid, _bot_id uuid, _perm text) returns boolean`
   - Old `has_team_access(viewer, owner)` / `has_team_perm(viewer, owner, perm)` are kept as thin wrappers that return `false` (so any leftover policy fails closed) and then removed after sweep.

3. **RLS policy rewrite** on every table currently using `has_team_access/has_team_perm` against `user_id`:
   - `bot_orders` (use `id` as bot_id)
   - `bot_commands`, `bot_logs`, `bot_config`, `bot_addon_state`, `bot_secrets`, `bot_runtime_status`, `bot_active_guilds`, `bot_channel_cache`, `bot_role_cache`, `bot_credits`, `bot_free_periods`, `bot_pending_discounts`, `bot_server_slots`
   - Each policy switches from `has_team_access(auth.uid(), user_id)` to `has_bot_team_access(auth.uid(), bot_id)`.

4. **`dashboard_role_permissions`** — extend to `(owner_user_id, bot_id, role)` so per-bot permission overrides are possible. Backfill existing rows across the owner's bots.

## Frontend changes

- **Team Management Hub** moves from a global "my team" view to a **bot-scoped** Team tab inside each bot's dashboard. The page-level "Team" route either:
  - lists each bot with its own member roster, or
  - is removed in favor of the per-bot tab (decide during implementation).
- **Invite flow** in `team-invite-send` adds a `bot_id` parameter. Invite email and accept URL include the bot context.
- `useTeamRole(ownerId)` becomes `useTeamRole(botId)`. Update all consumers (`ReadOnlyBotScope`, role badges, gates).
- Bot list (`useOwnedBots`) — team members see only bots they're invited to (no change needed if RLS is correct; verify).

## Edge function changes

- `team-invite-send`: require `bot_id`, validate the caller owns that bot, insert per-bot row.
- `team-transfer-send` / accept flow: transfers move ownership of selected bots only (already supports `transfer_bot_ids`); confirm the per-bot model is consistent.

## Migration plan (order)

1. Migration A: add nullable `bot_id`, backfill rows, make `NOT NULL`, swap unique index.
2. Migration B: create `has_bot_team_access` + `has_bot_team_perm`.
3. Migration C: rewrite RLS policies table by table.
4. Migration D: drop old `has_team_access` / `has_team_perm`.
5. Ship frontend + edge function changes in the same release as migrations B/C so the UI matches the new contract.

## Out of scope

- Admin (`app_role = 'admin'`) access. Admins keep global access; the user confirmed only auto-team-copy is the concern.
- Changing how `dashboard_team` invites are delivered (email template unchanged aside from bot context).

## Risks

- Backfill multiplies rows: a team of 5 with 4 bots becomes 20 rows. Fine at current scale.
- Any code path that still calls `has_team_access(viewer, owner)` after the cutover silently denies — sweep all SQL functions and edge functions in step 3.
- Realtime subscriptions on `dashboard_team` keyed on `owner_user_id` continue to work; add `bot_id` filter on the client where roster is rendered per bot.
