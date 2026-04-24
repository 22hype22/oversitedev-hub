
DROP POLICY IF EXISTS "Authenticated can read product image metadata" ON storage.objects;

-- Allow only admins to list product-images contents (file metadata).
-- Public direct URLs still work because the bucket is marked public.
CREATE POLICY "Admins can list product images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );
