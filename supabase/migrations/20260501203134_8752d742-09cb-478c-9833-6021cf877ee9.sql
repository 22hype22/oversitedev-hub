ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS bot_sales_mode text NOT NULL DEFAULT 'preorder';

ALTER TABLE public.app_settings
DROP CONSTRAINT IF EXISTS app_settings_bot_sales_mode_check;

ALTER TABLE public.app_settings
ADD CONSTRAINT app_settings_bot_sales_mode_check
CHECK (bot_sales_mode IN ('preorder', 'live'));