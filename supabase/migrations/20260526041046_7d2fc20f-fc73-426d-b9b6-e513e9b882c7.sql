-- Anon INSERT + SELECT policies for protection_events
CREATE POLICY "Anon bots can insert protection events"
ON public.protection_events
FOR INSERT
TO anon
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can view protection events"
ON public.protection_events
FOR SELECT
TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders));

-- Anon INSERT + SELECT policies for banned_members_backup
CREATE POLICY "Anon bots can insert banned member backups"
ON public.banned_members_backup
FOR INSERT
TO anon
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can view banned member backups"
ON public.banned_members_backup
FOR SELECT
TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders));

-- Anon INSERT + SELECT policies for nuke_actions
CREATE POLICY "Anon bots can insert nuke actions"
ON public.nuke_actions
FOR INSERT
TO anon
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can view nuke actions"
ON public.nuke_actions
FOR SELECT
TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders));