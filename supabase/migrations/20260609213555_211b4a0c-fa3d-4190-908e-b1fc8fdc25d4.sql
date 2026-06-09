CREATE TABLE public.liked_songs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  track_title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.liked_songs ADD CONSTRAINT liked_songs_unique_like UNIQUE (bot_id, user_id, track_title);

GRANT SELECT, INSERT, DELETE ON public.liked_songs TO anon;
GRANT SELECT, INSERT, DELETE ON public.liked_songs TO authenticated;
GRANT ALL ON public.liked_songs TO service_role;

ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "liked_songs_anon_select" ON public.liked_songs FOR SELECT TO anon USING (true);
CREATE POLICY "liked_songs_anon_insert" ON public.liked_songs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "liked_songs_anon_delete" ON public.liked_songs FOR DELETE TO anon USING (true);