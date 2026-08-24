-- Cap upload size and (where reliable) restrict MIME types on the user-writable
-- storage buckets, so a single oversized or unexpected file can't exhaust
-- storage. These bucket limits are the real enforcement; the dashboard's
-- client-side checks (src/lib/uploadValidation.ts) just give instant feedback.
-- Keep the two in sync.

-- Captcha pool: images only, 5 MB.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
WHERE id = 'captcha-images';

-- Portfolio media: images + short clips, 50 MB.
UPDATE storage.buckets
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
      'image/png', 'image/jpeg', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime'
    ]
WHERE id = 'portfolio';

-- bot-assets: /say attachments + bug/feature proof files. Size-capped at 25 MB.
-- MIME left unrestricted here because browsers report inconsistent types for
-- some allowed docs (e.g. .log, .zip); the 25 MB cap is what guards the server.
UPDATE storage.buckets
SET file_size_limit = 26214400
WHERE id = 'bot-assets';
