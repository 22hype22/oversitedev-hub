
-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('captcha-images', 'captcha-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read captcha-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'captcha-images');

CREATE POLICY "Authenticated can upload captcha-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'captcha-images');

CREATE POLICY "Authenticated can update captcha-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'captcha-images');

CREATE POLICY "Authenticated can delete captcha-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'captcha-images');

-- Table
CREATE TABLE public.captcha_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.captcha_images TO anon;
GRANT SELECT, INSERT, DELETE ON public.captcha_images TO authenticated;
GRANT ALL ON public.captcha_images TO service_role;

ALTER TABLE public.captcha_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read captcha images"
ON public.captcha_images FOR SELECT
USING (true);

CREATE POLICY "Authenticated can insert captcha images"
ON public.captcha_images FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can delete captcha images"
ON public.captcha_images FOR DELETE
TO authenticated
USING (true);
