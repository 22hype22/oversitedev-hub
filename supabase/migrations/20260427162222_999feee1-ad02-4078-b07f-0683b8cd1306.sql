-- Replace the public browsing view pattern with a real safe catalog table.
-- This table deliberately has no file_url or file_name columns.
CREATE TABLE IF NOT EXISTS public.product_catalog (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Systems'::text,
  emoji text DEFAULT '📦'::text,
  image_url text,
  image_urls text[] NOT NULL DEFAULT '{}'::text[],
  is_available boolean NOT NULL DEFAULT true,
  price_robux integer,
  gamepass_id text,
  gamepass_url text,
  current_version text,
  upgrade_price numeric DEFAULT 0,
  upgrade_price_robux integer,
  upgrade_gamepass_id text,
  upgrade_gamepass_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view product catalog" ON public.product_catalog;
CREATE POLICY "Anyone can view product catalog"
  ON public.product_catalog
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage product catalog" ON public.product_catalog;
CREATE POLICY "Admins can manage product catalog"
  ON public.product_catalog
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.sync_product_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.product_catalog WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.product_catalog (
    id,
    name,
    description,
    price,
    category,
    emoji,
    image_url,
    image_urls,
    is_available,
    price_robux,
    gamepass_id,
    gamepass_url,
    current_version,
    upgrade_price,
    upgrade_price_robux,
    upgrade_gamepass_id,
    upgrade_gamepass_url,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.name,
    NEW.description,
    NEW.price,
    NEW.category,
    NEW.emoji,
    NEW.image_url,
    NEW.image_urls,
    NEW.is_available,
    NEW.price_robux,
    NEW.gamepass_id,
    NEW.gamepass_url,
    NEW.current_version,
    NEW.upgrade_price,
    NEW.upgrade_price_robux,
    NEW.upgrade_gamepass_id,
    NEW.upgrade_gamepass_url,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    category = EXCLUDED.category,
    emoji = EXCLUDED.emoji,
    image_url = EXCLUDED.image_url,
    image_urls = EXCLUDED.image_urls,
    is_available = EXCLUDED.is_available,
    price_robux = EXCLUDED.price_robux,
    gamepass_id = EXCLUDED.gamepass_id,
    gamepass_url = EXCLUDED.gamepass_url,
    current_version = EXCLUDED.current_version,
    upgrade_price = EXCLUDED.upgrade_price,
    upgrade_price_robux = EXCLUDED.upgrade_price_robux,
    upgrade_gamepass_id = EXCLUDED.upgrade_gamepass_id,
    upgrade_gamepass_url = EXCLUDED.upgrade_gamepass_url,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_product_catalog() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_product_catalog() FROM anon;
REVOKE ALL ON FUNCTION public.sync_product_catalog() FROM authenticated;

INSERT INTO public.product_catalog (
  id,
  name,
  description,
  price,
  category,
  emoji,
  image_url,
  image_urls,
  is_available,
  price_robux,
  gamepass_id,
  gamepass_url,
  current_version,
  upgrade_price,
  upgrade_price_robux,
  upgrade_gamepass_id,
  upgrade_gamepass_url,
  created_at,
  updated_at
)
SELECT
  id,
  name,
  description,
  price,
  category,
  emoji,
  image_url,
  image_urls,
  is_available,
  price_robux,
  gamepass_id,
  gamepass_url,
  current_version,
  upgrade_price,
  upgrade_price_robux,
  upgrade_gamepass_id,
  upgrade_gamepass_url,
  created_at,
  updated_at
FROM public.products
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  category = EXCLUDED.category,
  emoji = EXCLUDED.emoji,
  image_url = EXCLUDED.image_url,
  image_urls = EXCLUDED.image_urls,
  is_available = EXCLUDED.is_available,
  price_robux = EXCLUDED.price_robux,
  gamepass_id = EXCLUDED.gamepass_id,
  gamepass_url = EXCLUDED.gamepass_url,
  current_version = EXCLUDED.current_version,
  upgrade_price = EXCLUDED.upgrade_price,
  upgrade_price_robux = EXCLUDED.upgrade_price_robux,
  upgrade_gamepass_id = EXCLUDED.upgrade_gamepass_id,
  upgrade_gamepass_url = EXCLUDED.upgrade_gamepass_url,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

DROP TRIGGER IF EXISTS sync_product_catalog_on_products ON public.products;
CREATE TRIGGER sync_product_catalog_on_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_catalog();

-- Keep the legacy view non-privileged so it no longer triggers the security-definer view warning.
-- New application code reads from product_catalog instead.
ALTER VIEW public.public_products SET (security_invoker = true);
GRANT SELECT ON public.product_catalog TO anon, authenticated;

-- Underlying products table remains restricted so file_url/file_name are never public by direct reads.
DROP POLICY IF EXISTS "Public can view all products basic" ON public.products;
DROP POLICY IF EXISTS "Public can view available products basic" ON public.products;