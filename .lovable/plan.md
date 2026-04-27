## Goal

Make the Bot Dashboard (`/bot-dashboard`) the place where customers manage **their own bots**, with one section per bot they own. Access is unlocked only when a bot order includes the **$149.99 Web Dashboard** add-on (`addon id: "dashboard"`). Without it, users manage their bot via in-Discord `/cmds` only.

## Access rules

A user has access to the Bot Dashboard if **any** of their `bot_orders` rows:
- `status` is `paid` (or `submitted` while we don't have payments wired yet — see Open question), AND
- `addons` array contains `"dashboard"`.

Admins keep full access regardless.

In the navbar dropdown:
- "Dashboard" link visible + clickable only when the user has at least one bot with the Web Dashboard add-on (or is admin).
- Otherwise show it as Locked (same pattern as today).

## Page structure

Rename and restructure `src/pages/BotDashboard.tsx`:

- Header title: **"Manage Your Bots"** (replaces "Manage Oversite").
- Sub-text: short blurb explaining each section below is one of their bots.
- Below the header, render one section **per owned bot** the user has:
  - Section heading: **"Managing {bot_name}"** with the bot's icon (or default Bot icon).
  - Small badge under the name showing the base (Protection / Support / Utilities / From Scratch) and add-ons count.
  - Below: the existing plugin grid (Settings, Auto Reply, Automod, …) — scoped visually to that bot.
- If the user owns **0 bots with the Web Dashboard add-on**, show a friendly empty/locked state explaining:
  - "The Web Dashboard add-on unlocks bot management from this site."
  - "Without it, you can still configure your bot in Discord with `/cmds`."
  - CTA button → `/bots` (Bot Builder) to add the Web Dashboard add-on.

For now plugins remain non-functional placeholder cards (same as today) — wiring real config comes later.

## Data fetching

In `BotDashboard.tsx`:
- Use `useAuth` for the current user.
- Query `bot_orders` for `user_id = auth.uid()`, filter client-side to rows where `addons` includes `"dashboard"` and (for now) `status in ('submitted','paid')`.
- Map each qualifying order → one "Managing {bot_name}" section.

No schema changes needed — `bot_orders` already stores `bot_name`, `icon_url`, `base`, `addons`, `status`.

## Navbar gating

In `src/components/site/Navbar.tsx`:
- Add a small hook (or inline query) that returns `hasBotDashboardAccess: boolean` based on the same `bot_orders` query above (admins always true).
- Replace the current `isAdmin`-based gate on the "Dashboard" item (desktop dropdown + mobile menu) with `hasBotDashboardAccess`.

## Files to change

- `src/pages/BotDashboard.tsx` — restructure: title, per-bot sections, ownership query, empty state.
- `src/components/site/Navbar.tsx` — gate "Dashboard" link by Web Dashboard ownership instead of admin-only.
- (Optional) `src/hooks/useOwnedBots.tsx` — small new hook returning the user's qualifying bots so both pages share the logic.

## Open question (will default if no answer)

Right now there is no payment flow wired into bot orders, so orders sit at `status = 'submitted'` after the builder form. Should access unlock:
- **(default) On `submitted` or `paid`** — useful while testing, so users see their dashboard immediately after building, OR
- **Strictly on `paid`** — only after a real payment lands.

I'll go with the default (submitted or paid) and we can tighten to paid-only when checkout is wired up.
