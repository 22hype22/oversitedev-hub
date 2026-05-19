-- Service role: full access (bypasses RLS already, but explicit policies for clarity)
DROP POLICY IF EXISTS "Service role full select on bot_commands" ON public.bot_commands;
DROP POLICY IF EXISTS "Service role full insert on bot_commands" ON public.bot_commands;
DROP POLICY IF EXISTS "Service role full update on bot_commands" ON public.bot_commands;

CREATE POLICY "Service role full select on bot_commands"
ON public.bot_commands
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Service role full insert on bot_commands"
ON public.bot_commands
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role full update on bot_commands"
ON public.bot_commands
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Anon (worker using SUPABASE_ANON_KEY): SELECT access on all bot_commands rows
DROP POLICY IF EXISTS "Anon can read bot_commands" ON public.bot_commands;

CREATE POLICY "Anon can read bot_commands"
ON public.bot_commands
FOR SELECT
TO anon
USING (true);

-- Anon also needs UPDATE so the worker can mark commands as claimed/done/failed
DROP POLICY IF EXISTS "Anon can update bot_commands" ON public.bot_commands;

CREATE POLICY "Anon can update bot_commands"
ON public.bot_commands
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);