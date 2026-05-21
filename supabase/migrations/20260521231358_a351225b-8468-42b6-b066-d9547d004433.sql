-- The unified team invite shares one invite_token across all of the owner's
-- bots so a single accept link works regardless of which row is looked up.
-- That conflicts with the old UNIQUE constraint on invite_token. Replace it
-- with a non-unique index so multiple rows can share a token.
ALTER TABLE public.dashboard_team
  DROP CONSTRAINT IF EXISTS dashboard_team_invite_token_key;
DROP INDEX IF EXISTS public.dashboard_team_invite_token_key;
CREATE INDEX IF NOT EXISTS dashboard_team_invite_token_idx
  ON public.dashboard_team (invite_token)
  WHERE invite_token IS NOT NULL;