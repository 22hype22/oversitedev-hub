CREATE POLICY "Anon bots can read bot_config"
ON public.bot_config
FOR SELECT
TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can update bot_config applied_at"
ON public.bot_config
FOR UPDATE
TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders))
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));

GRANT SELECT, UPDATE ON public.bot_config TO anon;