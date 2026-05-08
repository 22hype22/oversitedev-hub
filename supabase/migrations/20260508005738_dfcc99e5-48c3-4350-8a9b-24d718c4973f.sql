
-- Allow anon to read post_message rows it has claimed (to verify status)
DROP POLICY IF EXISTS "Anon can read post_message commands" ON public.bot_commands;
CREATE POLICY "Anon can read post_message commands"
ON public.bot_commands
FOR SELECT
TO anon, authenticated
USING (action = 'post_message');

-- Allow anon to update post_message rows
DROP POLICY IF EXISTS "Anon can update post_message commands" ON public.bot_commands;
CREATE POLICY "Anon can update post_message commands"
ON public.bot_commands
FOR UPDATE
TO anon, authenticated
USING (action = 'post_message')
WITH CHECK (action = 'post_message');

-- Ensure the completion RPC is callable by anon
GRANT EXECUTE ON FUNCTION public.complete_post_message(uuid, text, text) TO anon, authenticated;
