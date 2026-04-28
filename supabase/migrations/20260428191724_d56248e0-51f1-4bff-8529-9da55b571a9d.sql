ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS payment_plan text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS plan_months integer,
  ADD COLUMN IF NOT EXISTS installment_amount numeric;

ALTER TABLE public.bot_orders
  DROP CONSTRAINT IF EXISTS bot_orders_payment_plan_check;
ALTER TABLE public.bot_orders
  ADD CONSTRAINT bot_orders_payment_plan_check
  CHECK (payment_plan IN ('full','installments'));