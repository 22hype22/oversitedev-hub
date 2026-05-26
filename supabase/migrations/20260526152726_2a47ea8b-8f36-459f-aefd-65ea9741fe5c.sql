
-- Grants for anon on bot_commands (column-level matches bot_runtime_status pattern)
GRANT SELECT (id, bot_id, user_id, action, payload, status, worker_id, claimed_at, completed_at, error_message, created_at, updated_at) ON public.bot_commands TO anon;
GRANT UPDATE (status, worker_id, claimed_at, completed_at, error_message, updated_at) ON public.bot_commands TO anon;

-- RLS policies for anon scoped to bot_id existing in bot_orders
CREATE POLICY "Anon bots can view bot commands"
ON public.bot_commands
FOR SELECT
TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can update bot commands"
ON public.bot_commands
FOR UPDATE
TO anon
USING (bot_id IN (SELECT id FROM public.bot_orders))
WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));
