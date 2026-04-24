ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_discord boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS preferred_contact text NOT NULL DEFAULT 'email';