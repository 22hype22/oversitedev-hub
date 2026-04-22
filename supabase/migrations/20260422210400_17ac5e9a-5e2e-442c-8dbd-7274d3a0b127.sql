
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_name text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-files', 'product-files', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can read product files'
  ) THEN
    CREATE POLICY "Admins can read product files"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'product-files' AND public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can upload product files'
  ) THEN
    CREATE POLICY "Admins can upload product files"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'product-files' AND public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can update product files'
  ) THEN
    CREATE POLICY "Admins can update product files"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'product-files' AND public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can delete product files'
  ) THEN
    CREATE POLICY "Admins can delete product files"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'product-files' AND public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
