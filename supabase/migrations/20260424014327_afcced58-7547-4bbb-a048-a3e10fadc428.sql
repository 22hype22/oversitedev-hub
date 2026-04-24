
-- 1. Public products view that hides internal file paths
CREATE OR REPLACE VIEW public.public_products
WITH (security_invoker = true) AS
SELECT
  id, name, description, price, price_robux, category, emoji,
  image_url, image_urls, gamepass_id, gamepass_url,
  is_available, created_at, updated_at
FROM public.products;

GRANT SELECT ON public.public_products TO anon, authenticated;

-- Restrict base products table SELECT to admins only (buyers/anon use the view)
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Admins can view all product fields"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Storage: buyers can read product-files for their completed purchases
CREATE POLICY "Buyers can read their purchased files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-files'
    AND EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.user_id = auth.uid()
        AND p.status = 'paid'
        AND p.file_url = storage.objects.name
    )
  );

-- 3. Storage: stop anonymous listing of product-images bucket while keeping
-- direct public URL access (public buckets serve files via the public endpoint
-- regardless of storage.objects RLS policies).
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
CREATE POLICY "Authenticated can read product image metadata"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images');

-- 4. Tighten pending_purchases insert policy (was WITH CHECK true)
DROP POLICY IF EXISTS "Anyone can create a pending purchase" ON public.pending_purchases;
CREATE POLICY "Valid pending purchase inserts"
  ON public.pending_purchases FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    product_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.products pr WHERE pr.id = product_id AND pr.is_available = true)
    AND length(coalesce(roblox_username, '')) BETWEEN 1 AND 50
    AND length(coalesce(gamepass_id, '')) BETWEEN 1 AND 50
    AND status = 'pending'
  );
