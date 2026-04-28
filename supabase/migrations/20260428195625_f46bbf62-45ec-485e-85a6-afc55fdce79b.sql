ALTER TABLE public.bot_orders
ADD COLUMN IF NOT EXISTS engine_version text NOT NULL DEFAULT 'v1';

ALTER TABLE public.bot_orders
DROP CONSTRAINT IF EXISTS bot_orders_engine_version_check;

ALTER TABLE public.bot_orders
ADD CONSTRAINT bot_orders_engine_version_check CHECK (engine_version IN ('v1','v2'));