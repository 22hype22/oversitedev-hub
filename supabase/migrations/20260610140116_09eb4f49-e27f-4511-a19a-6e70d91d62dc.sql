CREATE TABLE public.music_taste (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bot_id text NOT NULL,
  guild_id text NOT NULL,
  scores jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.music_taste ADD CONSTRAINT music_taste_bot_guild_unique UNIQUE (bot_id, guild_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_taste TO anon;
GRANT ALL ON public.music_taste TO service_role;

ALTER TABLE public.music_taste ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon selects on music_taste"
  ON public.music_taste
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon inserts on music_taste"
  ON public.music_taste
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon updates on music_taste"
  ON public.music_taste
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon deletes on music_taste"
  ON public.music_taste
  FOR DELETE
  TO anon
  USING (true);