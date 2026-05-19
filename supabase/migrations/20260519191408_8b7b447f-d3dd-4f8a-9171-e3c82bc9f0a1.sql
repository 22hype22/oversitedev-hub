
CREATE POLICY "Owners can insert bot commands"
ON public.bot_commands
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = requested_by
  AND bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid())
);
