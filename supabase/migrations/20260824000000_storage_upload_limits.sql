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

-- bot-assets: /say attachments + bug/feature proof files. 25 MB, images + docs
-- only. The allowlist inherently blocks executables and server scripts
-- (.php/.jsp/.exe) and script-carrying markup (.html/.svg/.js) from being stored
-- via the API. The dashboard normalizes each file's content-type on upload so
-- legit docs (.log/.csv/.zip) still satisfy this list.
UPDATE storage.buckets
SET file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
      'image/png', 'image/jpeg', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/json', 'text/csv',
      'application/zip', 'application/x-zip-compressed'
    ]
WHERE id = 'bot-assets';
