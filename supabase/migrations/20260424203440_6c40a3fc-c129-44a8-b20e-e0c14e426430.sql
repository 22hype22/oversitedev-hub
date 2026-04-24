-- Recreate the public_products view with security_invoker so RLS is checked
-- against the calling user, not the view owner. The view excludes
-- file_url and file_name, so download links can never leak through it.
ALTER VIEW public.public_products SET (security_invoker = on);

-- Allow anonymous and authenticated users to read the safe view.
-- The underlying public.products table still has no SELECT policy for
-- non-admins, so file_url / file_name remain admin-only.
GRANT SELECT ON public.public_products TO anon, authenticated;