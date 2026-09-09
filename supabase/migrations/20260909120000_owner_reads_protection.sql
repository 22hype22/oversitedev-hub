-- The dashboard's Fleet activity chart draws on the Protection bot's event
-- tables, but only team members could read them. Owners read their own.
DROP POLICY IF EXISTS "Owners view protection_events" ON public.protection_events;
CREATE POLICY "Owners view protection_events"
  ON public.protection_events FOR SELECT TO authenticated
  USING (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners view nuke_actions" ON public.nuke_actions;
CREATE POLICY "Owners view nuke_actions"
  ON public.nuke_actions FOR SELECT TO authenticated
  USING (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
