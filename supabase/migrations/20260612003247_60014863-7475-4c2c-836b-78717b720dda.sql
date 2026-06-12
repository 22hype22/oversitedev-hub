
-- Drop all anon RLS policies on the four music tables.
-- Workers now access these tables exclusively through runtime_music_op.

-- liked_songs (3 policies)
DROP POLICY IF EXISTS "liked_songs_anon_select" ON public.liked_songs;
DROP POLICY IF EXISTS "liked_songs_anon_insert" ON public.liked_songs;
DROP POLICY IF EXISTS "liked_songs_anon_delete" ON public.liked_songs;

-- music_taste (4 policies)
DROP POLICY IF EXISTS "Allow anon selects on music_taste" ON public.music_taste;
DROP POLICY IF EXISTS "Allow anon inserts on music_taste" ON public.music_taste;
DROP POLICY IF EXISTS "Allow anon updates on music_taste" ON public.music_taste;
DROP POLICY IF EXISTS "Allow anon deletes on music_taste" ON public.music_taste;

-- music_resume (4 policies)
DROP POLICY IF EXISTS "Allow anon selects on music_resume" ON public.music_resume;
DROP POLICY IF EXISTS "Allow anon inserts on music_resume" ON public.music_resume;
DROP POLICY IF EXISTS "Allow anon deletes on music_resume" ON public.music_resume;
DROP POLICY IF EXISTS "Allow anon updates on music_resume" ON public.music_resume;

-- music_bridge (4 policies)
DROP POLICY IF EXISTS "Allow anon selects on music_bridge" ON public.music_bridge;
DROP POLICY IF EXISTS "Allow anon inserts on music_bridge" ON public.music_bridge;
DROP POLICY IF EXISTS "Allow anon updates on music_bridge" ON public.music_bridge;
DROP POLICY IF EXISTS "Allow anon deletes on music_bridge" ON public.music_bridge;
