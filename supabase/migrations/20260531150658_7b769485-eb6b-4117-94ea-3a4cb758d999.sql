
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  channel_name TEXT NOT NULL,
  category TEXT,
  opener_user_id TEXT,
  opener_username TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  claimed_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tickets_bot_status ON public.tickets(bot_id, status);
CREATE INDEX idx_tickets_guild ON public.tickets(guild_id);

GRANT SELECT, INSERT, UPDATE ON public.tickets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Anon (the bots) can insert/select/update rows for any bot_id that exists in bot_orders.
CREATE POLICY "Anon bots can view tickets"
ON public.tickets FOR SELECT TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can insert tickets"
ON public.tickets FOR INSERT TO anon
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can update tickets"
ON public.tickets FOR UPDATE TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders))
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));

-- Owners
CREATE POLICY "Owners can view their tickets"
ON public.tickets FOR SELECT TO authenticated
USING (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

CREATE POLICY "Owners can update their tickets"
ON public.tickets FOR UPDATE TO authenticated
USING (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()))
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

CREATE POLICY "Owners can delete their tickets"
ON public.tickets FOR DELETE TO authenticated
USING (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

-- Admins
CREATE POLICY "Admins can view all tickets"
ON public.tickets FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all tickets"
ON public.tickets FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Team access (matches pattern used by other bot tables)
CREATE POLICY "Team: view tickets"
ON public.tickets FOR SELECT TO authenticated
USING (has_bot_team_access(auth.uid(), bot_id));

CREATE POLICY "Team: manage tickets"
ON public.tickets FOR ALL TO authenticated
USING (has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'::text))
WITH CHECK (has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'::text));

-- Service role
CREATE POLICY "Service role manages tickets"
ON public.tickets FOR ALL TO service_role
USING (true) WITH CHECK (true);
