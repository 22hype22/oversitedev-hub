DROP POLICY IF EXISTS "Worker heartbeat can resolve bot status upsert" ON public.bot_runtime_status;

CREATE POLICY "Worker heartbeat can resolve bot status upsert"
ON public.bot_runtime_status
FOR SELECT
TO anon
USING (public.bot_runtime_status_can_write(bot_id, user_id));