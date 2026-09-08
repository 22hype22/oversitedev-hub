-- Robux checkout for bot orders on the website.
--
-- A customer can pay a bot order with Robux instead of a card. The order gets
-- its own one-off Roblox gamepass priced at the order total in Robux; owning
-- that gamepass is the proof of payment.
--
-- app_settings: the on/off switch.
-- bot_orders:   how the order was paid plus the gamepass and buyer details.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS robux_orders_enabled boolean NOT NULL DEFAULT true;

-- The price rule is fixed in code: 10,000 Robux per 100 dollars plus 30
-- percent, rounded to end in 999. Nothing about the rate lives in the
-- database. (An earlier draft added a robux_per_usd column; it is unused.)

ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'card';

ALTER TABLE public.bot_orders
  DROP CONSTRAINT IF EXISTS bot_orders_payment_method_check;
ALTER TABLE public.bot_orders
  ADD CONSTRAINT bot_orders_payment_method_check
  CHECK (payment_method IN ('card', 'robux', 'comped'));

ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS robux_gamepass_id text,
  ADD COLUMN IF NOT EXISTS robux_amount integer,
  ADD COLUMN IF NOT EXISTS roblox_username text,
  ADD COLUMN IF NOT EXISTS roblox_user_id bigint;

CREATE INDEX IF NOT EXISTS bot_orders_robux_gamepass_idx
  ON public.bot_orders (robux_gamepass_id)
  WHERE robux_gamepass_id IS NOT NULL;
