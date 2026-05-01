CREATE POLICY "Service role manages secret slots"
ON public.bot_secret_slots
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);