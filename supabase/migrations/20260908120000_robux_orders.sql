-- Robux checkout for bot orders on the website.
--
-- A customer can pay a bot order with Robux instead of a card. The order gets
-- its own one-off Roblox gamepass priced at the order total converted with the
-- site-wide rate below; owning that gamepass is the proof of payment.
--
-- app_settings: the switch and the rate (Robux per 1 USD).
-- bot_orders:   how the order was paid plus the gamepass and buyer details.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS robux_orders_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS robux_per_usd numeric NOT NULL DEFAULT 400;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_robux_per_usd_check;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_robux_per_usd_check CHECK (robux_per_usd > 0);

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
