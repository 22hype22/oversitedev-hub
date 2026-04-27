# What I'd add next

We just built the preorder flow and the admin orders log, but the loop isn't closed yet. The user can preorder, and you can *see* the queue — but there's no way to move an order through stages, and the user has no idea what's happening with their bot after they hit "Preorder."

Here's what I'd add, in priority order. Pick any subset.

---

## 1. Admin: change order status from the log (high value, small lift)

Right now `BotOrdersLog` is read-only. You can see "Preorder / Paid / In-Build / Live" but can't change them. Add a status dropdown on each row so you can manually advance an order:

`Preorder → Paid → In Build → Ready → Live` (or `Cancelled`)

Also add:
- A notes field you can edit per order (build notes, blockers, links to the artifact)
- Optional "delivery URL" field so when you mark it Ready, the user sees a download/invite link

This is what actually makes the queue useful — without it the log is just a viewer.

## 2. User: status badge on each bot in the dashboard (high value, small lift)

Pulled straight from `.lovable/plan.md` #1. Each bot section in `/bot-dashboard` shows a badge:

`Preorder placed` · `In build` · `Ready to invite` · `Live`

Reads from `bot_orders.status`. Pairs perfectly with #1 — you flip the status, the user sees it update.

## 3. User: preorder confirmation / "what happens next" screen

After preorder submission the user gets a toast and... that's it. Add a small confirmation card on the dashboard for any order in `submitted` state:

> **Preorder #X received** — you're #3 in the queue. We'll reach out within 24h to confirm scope and finalize payment.

Reduces "did it go through?" support questions.

## 4. Admin: queue position is visible to the user

Tiny addition to #2 — show "Position #3 in build queue" on Preorder-status bots. Calculated the same way `BotOrdersLog` already does it (`submitted_at` ascending).

## 5. Hide plugin cards the user doesn't own

From `.lovable/plan.md` #8. The plugin grid currently shows every possible plugin even if the user only bought Protection. Filter to enabled ones based on `addons[]` on the order. Makes the dashboard feel honest.

---

## My pick if you want just one thing

**Do #1 + #2 together.** They're the same feature from two sides (admin moves the lever, user sees the result) and together they make the preorder system actually function instead of just collecting rows in a table.

## What I'd skip for now

- Transfer ownership, edit identity, remove add-ons, billing history — all real but no one is asking yet
- Real hosting telemetry — placeholder isn't worth the visual noise
- Onboarding checklist — wait until you have enough live bots to know what trips users up

---

## Technical notes

- All status changes go through existing `bot_orders` UPDATE policy (admins only) — no schema changes needed for #1 unless we add a `delivery_url` column
- For #1 delivery URL: one column add, `delivery_url text nullable` on `bot_orders`
- #2/#3/#4 are pure frontend reads from `bot_orders.status` + `submitted_at`
- #5 is a filter on the existing `plugins` array against `order.addons`

Want me to build #1 + #2, or pick a different combination?
