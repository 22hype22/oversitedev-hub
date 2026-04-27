-- Restore anonymous storefront visibility through the safe public catalog view.
-- The view intentionally excludes products.file_url and products.file_name, so public users
-- can browse products without exposing internal product-file storage paths.

CREATE OR REPLACE VIEW public.public_products AS
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
FROM public.products;

ALTER VIEW public.public_products SET (security_invoker = false);

GRANT SELECT ON public.public_products TO anon, authenticated;

-- Keep the underlying products table restricted so file_url/file_name are not exposed by direct table reads.
DROP POLICY IF EXISTS "Public can view all products basic" ON public.products;
DROP POLICY IF EXISTS "Public can view available products basic" ON public.products;

-- Admin full-product access remains covered by the existing admin policy.