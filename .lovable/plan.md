# Suggested follow-ups

These are gaps I noticed across the builder, dashboard, and ownership flow. Pick whichever feel useful — none are blockers.

## 1. Order status visibility

Right now bots show up in the dashboard once they're `submitted` or `paid`, but the user can't tell which stage their bot is in. Add a status badge to each bot section: **Submitted → In build → Ready → Live**. Pulls from `bot_orders.status` (and optionally `bot_build_jobs.status` for finer-grained "we're building it now" state).

## 2. Edit bot identity

Once a bot is live, the user might want to rename it, swap the icon, or update the description without contacting support. Add an "Edit details" button on each bot section that opens a small dialog editing `bot_name`, `bot_description`, `icon_url`, `banner_url`.

## 3. Remove individual add-ons

We added "Add more add-ons" but there's no way to drop one if the user changes their mind (e.g. they're not using the music player anymore). Mirror the add flow with a "Manage add-ons" view showing currently-owned ones with a remove option. Self-serve for unbilled changes; "contact support" once it's been billed.

## 4. Invoice / billing history per bot

Users currently can't see what they paid, when, or for which bot. A simple "Billing" tab on each bot section listing past charges (from `purchases` and `subscriptions`) would prevent a lot of "what am I paying for?" support tickets.

## 5. Hosting status indicator

If hosting is on, show a small live indicator (green dot = bot online, gray = offline, red = error) at the top of the bot section. Even a placeholder that just shows "Hosted" vs "Self-hosted" is useful right now until real telemetry is wired.

## 6. Onboarding / "next steps" after first bot purchase

The success screen tells the user where to find the dashboard, but the dashboard itself doesn't guide them. First time landing on `/bot-dashboard` after a build, show a one-time checklist: "Invite your bot to your server → Run `/setup` → Configure your first plugin." Dismissible.

## 7. Transfer bot ownership

Niche but real: server owners change. A "Transfer ownership" action that emails the new owner a claim link, then reassigns `user_id` on the `bot_orders` row.

## 8. Plugin cards are decorative

The plugin grid on each bot section currently links nowhere — clicking a card does nothing. Either wire each one to a real config page (bigger lift) or hide cards for plugins the user doesn't have enabled, so the dashboard reflects reality.

## My recommendation

If you only do two: **#1 (status badges)** and **#8 (only show enabled plugins)**. Together they make the dashboard feel honest about what state the bot is in and what the user actually owns. Everything else can wait until users start asking.

Tell me which (if any) you want and I'll build them.
