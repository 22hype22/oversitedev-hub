
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_robux integer,
  ADD COLUMN IF NOT EXISTS gamepass_id text,
  ADD COLUMN IF NOT EXISTS gamepass_url text;
