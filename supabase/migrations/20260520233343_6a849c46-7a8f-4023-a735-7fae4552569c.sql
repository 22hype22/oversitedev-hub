ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS bot_bio text,
  ADD COLUMN IF NOT EXISTS discord_last_username_change_at timestamptz;