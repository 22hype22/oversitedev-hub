ALTER TABLE public.bot_orders
ADD COLUMN IF NOT EXISTS railway_service_id text;

CREATE INDEX IF NOT EXISTS idx_bot_orders_railway_service_id
  ON public.bot_orders (railway_service_id)
  WHERE railway_service_id IS NOT NULL;