CREATE TABLE public.authorized_guilds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_order_id uuid NOT NULL REFERENCES public.bot_orders(id) ON DELETE CASCADE,
  guild_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_order_id, guild_id)
);

CREATE INDEX idx_authorized_guilds_bot_order ON public.authorized_guilds(bot_order_id);
CREATE INDEX idx_authorized_guilds_guild ON public.authorized_guilds(guild_id);

GRANT SELECT ON public.authorized_guilds TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authorized_guilds TO authenticated;
GRANT ALL ON public.authorized_guilds TO service_role;

ALTER TABLE public.authorized_guilds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon bots can view authorized guilds"
ON public.authorized_guilds
FOR SELECT
TO anon
USING (bot_order_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Owners can view their authorized guilds"
ON public.authorized_guilds
FOR SELECT
TO authenticated
USING (bot_order_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all authorized guilds"
ON public.authorized_guilds
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team can view authorized guilds"
ON public.authorized_guilds
FOR SELECT
TO authenticated
USING (has_bot_team_access(auth.uid(), bot_order_id));

CREATE POLICY "Service role manages authorized guilds"
ON public.authorized_guilds
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);