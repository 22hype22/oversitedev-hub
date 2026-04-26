-- Remove the overly permissive public SELECT policy on products that exposes file_url/file_name.
-- Public storefront already reads from the public_products view (which excludes those columns).
DROP POLICY IF EXISTS "Public can view all products basic" ON public.products;

-- Admins retain full access via the existing "Admins can view all product fields" policy.
-- Ensure the public_products view runs with the querying user's privileges (not the view owner)
-- so it doesn't bypass RLS unexpectedly. It already excludes file_url/file_name.
ALTER VIEW public.public_products SET (security_invoker = true);

-- Grant SELECT on the view to anon and authenticated so the storefront keeps working.
GRANT SELECT ON public.public_products TO anon, authenticated;