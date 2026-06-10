CREATE TABLE public.music_bridge (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  status text NOT NULL DEFAULT 'hold',
  requested_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.music_bridge ADD CONSTRAINT music_bridge_guild_unique UNIQUE (guild_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.music_bridge TO anon;
GRANT ALL ON public.music_bridge TO service_role;

ALTER TABLE public.music_bridge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon selects on music_bridge"
  ON public.music_bridge
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon inserts on music_bridge"
  ON public.music_bridge
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon updates on music_bridge"
  ON public.music_bridge
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon deletes on music_bridge"
  ON public.music_bridge
  FOR DELETE
  TO anon
  USING (true);