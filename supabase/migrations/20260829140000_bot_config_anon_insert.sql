-- Fix: economy / ads / free-release / announcement data resets on every redeploy.
--
-- Root cause: these features are written to bot_config ONLY by the bot itself
-- (the dashboard never creates their rows). The bot authenticates with the anon
-- key, which was granted SELECT and UPDATE on bot_config but NOT INSERT. An
-- upsert of a not-yet-existing row is an INSERT, so RLS silently denied it. The
-- economy-data row was therefore never created, nothing was ever persisted, and
-- every redeploy legitimately read "no data" and started everyone from zero.
--
-- Fix: allow anon to INSERT a bot_config row for any real bot (mirrors the
-- existing anon SELECT/UPDATE policies, which are already scoped to valid bots).
-- With INSERT allowed, the bot's upsert creates the row the first time and
-- UPDATEs it thereafter, so balances/properties survive redeploys.

GRANT INSERT ON public.bot_config TO anon;

DROP POLICY IF EXISTS "Anon bots can insert bot_config" ON public.bot_config;
CREATE POLICY "Anon bots can insert bot_config"
ON public.bot_config
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bot_orders
    WHERE bot_orders.id = bot_config.bot_id
  )
);

NOTIFY pgrst, 'reload schema';
