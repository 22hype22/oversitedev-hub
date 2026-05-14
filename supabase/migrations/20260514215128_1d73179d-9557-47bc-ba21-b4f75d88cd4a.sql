-- Ensure DM tracking columns exist on bot_orders (idempotent)
ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS dm_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ready_dm_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_dm_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_username text,
  ADD COLUMN IF NOT EXISTS build_started timestamp with time zone,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE INDEX IF NOT EXISTS idx_bot_orders_status_dm_sent
  ON public.bot_orders (status, dm_sent, ready_dm_sent, cancel_dm_sent);
