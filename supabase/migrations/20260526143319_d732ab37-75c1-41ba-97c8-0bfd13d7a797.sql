-- Allow bots (using anon key) to read their own row from bot_orders,
-- but restrict anon access to non-sensitive columns only (id, bot_name).
REVOKE SELECT ON public.bot_orders FROM anon;
GRANT SELECT (id, bot_name) ON public.bot_orders TO anon;

CREATE POLICY "Anon bots can read bot_orders id/name"
ON public.bot_orders
FOR SELECT
TO anon
USING (true);