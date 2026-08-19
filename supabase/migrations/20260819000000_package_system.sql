-- Automatic Package System — a Roblox package marketplace run through Discord.
-- Packers submit a package (files + details), staff review/accept (creating a
-- game pass + forum listing), and buyers claim it (ownership verified, ZIP DM'd).
--
-- All rows are keyed by bot_id (multi-tenant). Access is exclusively through the
-- `package-system` edge function using the service role, so RLS is enabled with
-- no permissive policies (service role bypasses RLS; nothing else can read).

-- ── Submissions ─────────────────────────────────────────────────────────────
CREATE TABLE public.package_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id uuid NOT NULL,
  submission_id integer NOT NULL,          -- human-facing, per-bot incrementing id
  user_id text NOT NULL,                   -- Discord id of the packer

  type text,
  customizable text,
  one_time_sell text,

  name text,
  items text[] NOT NULL DEFAULT '{}',
  price integer,
  tag text,

  zip_url text,
  preview_url text,
  zip_channel_id text,
  zip_message_id text,
  preview_channel_id text,
  preview_message_id text,

  status text NOT NULL DEFAULT 'pending',  -- pending | accepted | denied
  resolved_by text,

  review_channel_id text,
  review_message_id text,
  listing_channel_id text,
  listing_message_id text,
  game_pass_id text,

  claimed_by text[] NOT NULL DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, submission_id)
);

ALTER TABLE public.package_submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX package_submissions_bot_status_idx
  ON public.package_submissions (bot_id, status, created_at DESC);
CREATE INDEX package_submissions_bot_user_idx
  ON public.package_submissions (bot_id, user_id);

-- ── Drafts (in-progress submissions, one per packer per bot) ─────────────────
CREATE TABLE public.package_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id uuid NOT NULL,
  user_id text NOT NULL,
  editing_submission_id integer,
  type text,
  customizable text,
  one_time_sell text,
  name text,
  items text[] NOT NULL DEFAULT '{}',
  price integer,
  tag text,
  existing_zip_url text,
  existing_zip_channel_id text,
  existing_zip_message_id text,
  existing_preview_url text,
  existing_preview_channel_id text,
  existing_preview_message_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, user_id)
);

ALTER TABLE public.package_drafts ENABLE ROW LEVEL SECURITY;

-- ── Terms agreements (who has accepted the buyer terms) ─────────────────────
CREATE TABLE public.package_terms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id uuid NOT NULL,
  user_id text NOT NULL,
  agreed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, user_id)
);

ALTER TABLE public.package_terms ENABLE ROW LEVEL SECURITY;

-- ── Per-bot submission-id counter ───────────────────────────────────────────
CREATE TABLE public.package_counters (
  bot_id uuid NOT NULL PRIMARY KEY,
  next_id integer NOT NULL DEFAULT 1
);

ALTER TABLE public.package_counters ENABLE ROW LEVEL SECURITY;

-- Atomically reserve and return the next submission id for a bot.
CREATE OR REPLACE FUNCTION public.next_package_id(_bot_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id integer;
BEGIN
  INSERT INTO public.package_counters (bot_id, next_id)
  VALUES (_bot_id, 2)
  ON CONFLICT (bot_id) DO UPDATE SET next_id = public.package_counters.next_id + 1
  RETURNING next_id - 1 INTO _id;
  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.next_package_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_package_id(uuid) TO service_role;
