DROP VIEW IF EXISTS public.public_products;

CREATE VIEW public.public_products AS
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
  created_at,
  updated_at
FROM public.products;