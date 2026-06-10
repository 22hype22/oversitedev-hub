CREATE TABLE public.music_resume (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bot_id text NOT NULL,
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  track_uri text,
  track_title text,
  position_ms bigint NOT NULL DEFAULT 0,
  genre text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.music_resume ADD CONSTRAINT music_resume_bot_guild_unique UNIQUE (bot_id, guild_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_resume TO anon;
GRANT ALL ON public.music_resume TO service_role;

ALTER TABLE public.music_resume ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon selects on music_resume"
  ON public.music_resume
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon inserts on music_resume"
  ON public.music_resume
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon deletes on music_resume"
  ON public.music_resume
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow anon updates on music_resume"
  ON public.music_resume
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);