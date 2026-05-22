CREATE POLICY "Users can insert utilities send_channel_message"
ON public.bot_commands
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = requested_by
  AND bot_id = 'e7f81d81-5645-4d81-93d4-1ae58b6ba77f'::uuid
  AND action IN ('send_channel_message', 'bio_update_request')
);