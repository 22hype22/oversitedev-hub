-- Allow public to see ALL products (incl. unreleased "coming soon"),
-- but only non-sensitive columns via the public_products view.
-- Sensitive columns (file_url, file_name) remain admin-only because the
-- public_products view excludes them.

DROP POLICY IF EXISTS "Public can view available products basic" ON public.products;

CREATE POLICY "Public can view all products basic"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (true);