-- 1. Extend products with version + upgrade pricing fields
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS current_version text,
  ADD COLUMN IF NOT EXISTS upgrade_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upgrade_price_robux integer,
  ADD COLUMN IF NOT EXISTS upgrade_gamepass_id text,
  ADD COLUMN IF NOT EXISTS upgrade_gamepass_url text;

-- 2. product_versions table - file history per product
CREATE TABLE IF NOT EXISTS public.product_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version text NOT NULL,
  file_url text,
  file_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_versions_product_id_created
  ON public.product_versions(product_id, created_at DESC);

ALTER TABLE public.product_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product versions"
  ON public.product_versions FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert product versions"
  ON public.product_versions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update product versions"
  ON public.product_versions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete product versions"
  ON public.product_versions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add the new versions row to the public_products view as well — recreate it
-- (no schema change here for the view itself; storefront still reads products)

-- Trigger: keep only the 3 most recent versions per product
CREATE OR REPLACE FUNCTION public.prune_old_product_versions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.product_versions
  WHERE product_id = NEW.product_id
    AND id NOT IN (
      SELECT id FROM public.product_versions
      WHERE product_id = NEW.product_id
      ORDER BY created_at DESC
      LIMIT 3
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_old_product_versions ON public.product_versions;
CREATE TRIGGER trg_prune_old_product_versions
  AFTER INSERT ON public.product_versions
  FOR EACH ROW EXECUTE FUNCTION public.prune_old_product_versions();

-- 3. Track which version each purchase is for
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS version text;

ALTER TABLE public.pending_purchases
  ADD COLUMN IF NOT EXISTS version text,
  ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'initial';

-- 4. Subscriptions table for the $9/mo membership
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  price_id text,
  product_id text,
  status text NOT NULL,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_env
  ON public.subscriptions(user_id, environment, created_at DESC);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();