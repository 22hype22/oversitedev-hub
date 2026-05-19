# Monthly hosting billing + 10-day grace period

The dashboard currently has no recurring hosting charge — `monthly_hosting` is just a boolean on `bot_orders`. To deliver the grace-period behavior you described, we need the billing loop, the past-due detection, and the dashboard surfacing.

## What gets built

### 1. Monthly hosting subscription ($5 / $10 tier)
- New Stripe product `bot_hosting` with two prices: `bot_hosting_solo` ($5/mo) and `bot_hosting_multi` ($10/mo flat for 2+ bots).
- New `hosting_subscriptions` table keyed by `user_id`, tracking `stripe_subscription_id`, `status`, `current_period_end`, `price_id`, `environment`.
- On the user's first paid bot, prompt them to start the hosting subscription (Stripe Checkout). When they own a 2nd bot, swap the price to the `multi` tier; when they drop back to 1, swap back to `solo`. (Edge function: `sync-hosting-subscription`.)

### 2. Past-due detection (10-day grace)
- `payments-webhook` handles `invoice.payment_failed` and `customer.subscription.updated`:
  - Sets `hosting_subscriptions.status = 'past_due'` and stamps `past_due_since = now()`.
  - Computes `grace_period_ends_at = past_due_since + 10 days` and writes it on the row.
- `invoice.payment_succeeded` clears `past_due_since` / `grace_period_ends_at` and flips status back to `active`.

### 3. Auto-cancel cron
- New edge function `enforce-hosting-grace` runs daily via `pg_cron`.
- For every subscription where `status='past_due'` and `grace_period_ends_at < now()`:
  - Sets every `paid`/`ready` bot owned by that user to `status='cancelled'`, stamps `cancelled_at`, `cancellation_reason='hosting_payment_failed'`.
  - Enqueues a `leave_guild` command in `bot_commands` for each bot so the worker pulls the bot out of all its servers.
  - Sends a `bot_notifications` row and a DM via existing notification pipeline.

### 4. Dashboard surfacing
- Extend `useOwnedBots` `ACCESS_STATUSES` to include bots whose owner's hosting sub is `past_due` (they stay visible during the 10 days). Add `hostingStatus` + `graceDaysRemaining` to the hook's return.
- New `<HostingPastDueBanner />` shown on `Dashboard` and `BotDashboard` when `hostingStatus === 'past_due'`:
  - Professional copy along the lines of:
    > **Payment overdue.** We weren't able to charge your card for this month's bot hosting. You have **{N} day(s)** to update your payment method before your bot(s) are automatically cancelled and removed from your servers. If you believe this is a mistake, please open a ticket in our Discord server.
  - Primary button: **Update payment method** (opens Stripe Billing Portal via existing/new `create-portal-session` function).
  - Secondary link: **Open a support ticket** → Discord invite.
- Daily countdown is just `Math.ceil((grace_period_ends_at - now) / 1day)`, recomputed on each render.

## Files

**New**
- `supabase/migrations/<ts>_hosting_subscriptions.sql` — table + RLS + `pg_cron` job
- `supabase/functions/sync-hosting-subscription/index.ts`
- `supabase/functions/enforce-hosting-grace/index.ts`
- `supabase/functions/create-portal-session/index.ts` (if not already present)
- `src/hooks/useHostingSubscription.tsx`
- `src/components/dashboard/HostingPastDueBanner.tsx`

**Edited**
- `supabase/functions/payments-webhook/index.ts` — handle `invoice.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.updated`/`deleted` for the hosting price IDs
- `src/hooks/useOwnedBots.tsx` — include past-due bots, expose `hostingStatus`
- `src/pages/Dashboard.tsx`, `src/pages/BotDashboard.tsx` — mount banner
- `src/components/site/BotBuilder.tsx` — kick off hosting subscription on first paid bot

## Open question

The Discord invite URL for "open a ticket" — confirm the link before I hard-code it (or I'll read it from `app_settings`).
