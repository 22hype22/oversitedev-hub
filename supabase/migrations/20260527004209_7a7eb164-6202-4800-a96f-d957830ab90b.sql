-- Fix missing grants on bot_addon_state
GRANT SELECT ON public.bot_addon_state TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_addon_state TO authenticated;
GRANT ALL ON public.bot_addon_state TO service_role;

-- Allow bots (anon) to read their own addon states on startup
CREATE POLICY "Bots can read their addon state"
ON public.bot_addon_state
FOR SELECT
TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders));