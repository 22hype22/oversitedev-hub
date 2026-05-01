ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bot_orders_stripe_session_id
  ON public.bot_orders(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;