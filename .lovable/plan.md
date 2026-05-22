# Stock-driven order submission flow

## Scope

Wire up the order-submission UX so it's driven by real-time token availability instead of just the global admin sales-mode toggle. Gate every order with a "Join our Discord" confirmation modal that fires after payment succeeds. Send a single Discord-confirm DM per order (not per bot in a pack) when the order goes through the low-stock path.

## What changes

### 1. Dynamic button text (`BotBuilder.tsx`)

- Read `bot_token_pool` available count (reuse the `get_available_bot_token_count` RPC the indicator already polls).
- Compute `botsNeeded` from the current selection (1 for single, N for multi/pack).
- Button label:
  - `Order my bot →` when `available >= botsNeeded` **AND** admin sales mode is live.
  - `Preorder my bot →` otherwise (low/no stock OR admin set preorder).
- Applies to both the collapsed top-level button and the expanded "Confirm" button.

### 2. Discord-join modal — post-payment gate

A new component `DiscordJoinGate.tsx` shown on `/checkout/return` (and `/checkout/setup` success) when the just-completed session has a `bot_order_id`.

- Step A: "Join our Discord server to receive updates about your bot." with a link to `https://discord.gg/oversite` and an "I've joined" button.
- "I've joined" calls a new edge function `confirm-order-discord-join` that:
  - Loads the order (and its parent/siblings if part of a pack).
  - Re-checks `bot_token_pool` available count vs. `botsNeeded`.
  - **In stock path**: sets every row to `ready` (already triggers auto-deploy via existing DB trigger).
  - **Low/no stock path**: sets every row to `confirmation`, sets `confirmation_state = 'awaiting_username'`, stamps `confirmation_dm_sent_at`, and enqueues **one** `bot_notifications` row (parent order only) asking the customer to reply with their Discord username to confirm.
- After response, modal shows the matching message (deploying vs. DM-sent) and a link to the dashboard.

The Discord-join modal is **mandatory** — until the user clicks "I've joined", the order stays in `paid` / `preorder` and nothing deploys.

### 3. Username-confirmation reply handling

A new edge function `confirm-order-username` callable from the discord bot DM webhook (or from the dashboard as a fallback "I've confirmed" button) that:

- Looks up the order by `confirmation_state = 'awaiting_username'` + `discord_user_id`.
- Compares the reply text to `discord_username` (case-insensitive, trimmed).
- On match: re-checks token availability. If tokens available → status `ready` (triggers deploy). If still none → status `waitlist` (existing waitlist machinery promotes to `ready` when a token frees up). Stamps `confirmation_responded_at`, `confirmation_state = 'confirmed'`.
- On mismatch: increments a counter and DMs the user a retry prompt.

For this iteration we wire up the **dashboard fallback button** (the DM-reply handler can be a follow-up). The DM body already instructs them to confirm in dashboard if they prefer.

### 4. Pack handling — single DM

The `confirm-order-discord-join` function dedupes by `parent_order_id` (or `id` when there's no parent), so a 3-bot pack triggers exactly one `bot_notifications` row, not three.

## Status transitions (summary)

```text
                       ┌──────────────────────────────────────┐
                       │  user clicks Order/Preorder          │
                       │  payment completes (Stripe webhook)  │
                       └──────────────────────────────────────┘
                                       │
                          ┌────────────┴────────────┐
                          │                         │
                     paid (in stock)         preorder (card saved)
                          │                         │
                          └────────────┬────────────┘
                                       │
                       Discord-join modal on /checkout/return
                                       │
                  ┌────────────────────┴────────────────────┐
                  │                                         │
        tokens available now                       no tokens available
                  │                                         │
                ready  ──► auto-deploy ──► DM       confirmation + 1 DM
                                                            │
                                         user confirms username (DM or dashboard)
                                                            │
                                                ┌───────────┴──────────┐
                                                │                      │
                                          tokens now              still none
                                                │                      │
                                              ready              waitlist
                                                │                      │
                                          auto-deploy        promoted later
                                                │                      │
                                                DM ─────────────────── DM
```

## Files

- **Modify** `src/components/site/BotBuilder.tsx` — dynamic button label, share availability count via lightweight hook.
- **New** `src/hooks/useBotStockCount.tsx` — small hook wrapping the existing RPC poll so both the indicator and the builder share one source.
- **New** `src/components/checkout/DiscordJoinGate.tsx` — modal shown on `/checkout/return` and `/checkout/setup` success.
- **Modify** `src/pages/CheckoutReturn.tsx` — mount the gate when `isBotOrder`.
- **Modify** `src/pages/CheckoutSetup.tsx` — after `SetupIntent` success, route to a return URL that shows the gate.
- **New** `supabase/functions/confirm-order-discord-join/index.ts` — server-side status transition + DM enqueue.
- **New** `supabase/functions/confirm-order-username/index.ts` — server-side username-confirmation handler (dashboard-callable).
- **Modify** `src/components/dashboard/...` — add a "Confirm my username" button on orders in `confirmation` state (small UI surface, links to the new function).
- **No schema migration required** — `confirmation_state`, `confirmation_dm_sent_at`, `confirmation_responded_at`, `waitlist`, `confirmation`, `ready`, `paid` are all already on `bot_orders`.

## Technical notes

- The existing webhook already flips paid → `paid` when tokens are available, and to `waitlisted` when not. The new gate transitions `paid → ready` (in stock) or `paid → confirmation` (low stock). For the `preorder` (SetupIntent) path, the gate transitions `preorder → confirmation` (low stock is the expected path here; if stock has refilled by the time they finish saving the card, we still take the standard preorder route — confirmation DM, then charge-confirmed-order).
- The auto-deploy DB trigger fires on `status -> 'ready'`, so we don't have to call the deploy function directly.
- Stock checks happen **server-side** in the new edge functions — never trust the client value.
- The Discord-join gate is non-blocking on close: if the user navigates away, the order remains in `paid`/`preorder` and we surface a "Finish setup" banner on the dashboard with the same button.
