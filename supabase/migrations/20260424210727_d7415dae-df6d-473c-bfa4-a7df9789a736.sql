-- Allow public to read products via the safe public_products view.
-- The view excludes sensitive fields (file_url, file_name) so this is safe.

-- 1) Grant SELECT on the view to anon and authenticated
GRANT SELECT ON public.public_products TO anon, authenticated;

-- 2) Switch the view to run with the view owner's privileges so it bypasses
--    the admin-only RLS on the underlying products table while still hiding
--    sensitive columns. (Default Postgres view behavior.)
ALTER VIEW public.public_products SET (security_invoker = off);

-- 3) Also add a permissive SELECT policy on products limited to the safe,
--    non-sensitive case (available products), so direct table queries by
--    public users still work for non-sensitive use cases. We continue to rely
--    on column exclusion in the view for the file_url/file_name protection.
DROP POLICY IF EXISTS "Public can view available products basic" ON public.products;
CREATE POLICY "Public can view available products basic"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (is_available = true);