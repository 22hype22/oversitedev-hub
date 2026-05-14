ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS dm_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ready_dm_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_dm_sent boolean NOT NULL DEFAULT false;