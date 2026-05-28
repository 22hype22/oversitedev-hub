CREATE TABLE public.user_xp (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id uuid NOT NULL REFERENCES public.bot_orders(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, guild_id, user_id)
);

CREATE INDEX idx_user_xp_bot_guild ON public.user_xp(bot_id, guild_id);

GRANT SELECT, INSERT, UPDATE ON public.user_xp TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_xp TO authenticated;
GRANT ALL ON public.user_xp TO service_role;

ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon bots can read user_xp"
ON public.user_xp FOR SELECT TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can insert user_xp"
ON public.user_xp FOR INSERT TO anon
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can update user_xp"
ON public.user_xp FOR UPDATE TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders))
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Service role manages user_xp"
ON public.user_xp FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Owners can view their user_xp"
ON public.user_xp FOR SELECT TO authenticated
USING (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

CREATE POLICY "Team can view user_xp"
ON public.user_xp FOR SELECT TO authenticated
USING (has_bot_team_access(auth.uid(), bot_id));