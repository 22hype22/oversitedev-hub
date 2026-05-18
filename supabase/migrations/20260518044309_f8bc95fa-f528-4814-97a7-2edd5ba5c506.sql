
ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS parent_order_id uuid NULL REFERENCES public.bot_orders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS bot_orders_parent_order_id_idx
  ON public.bot_orders(parent_order_id);
