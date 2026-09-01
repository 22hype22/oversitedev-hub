-- Fix ER:LC / Roblox bots that were stored with monthly_hosting = true.
--
-- ER:LC / Roblox bots (dispatch, erlc-spec, customs) are ONE-TIME purchases,
-- hosted free. They were previously created with monthly_hosting hardcoded to
-- true, which (a) showed a misleading "Hosting" chip in the dashboard and
-- (b) made the column untrustworthy for billing logic.
--
-- This flips the column to false for every order whose base is ENTIRELY made up
-- of Roblox bases. Compound Discord orders (e.g. "protection+dispatch") keep
-- monthly_hosting = true because they DO contain a billable Discord bot.
--
-- Safe to run more than once (idempotent).
UPDATE public.bot_orders
SET monthly_hosting = false,
    updated_at = now()
WHERE monthly_hosting = true
  AND base IS NOT NULL
  AND base <> ''
  -- every space/plus/comma-separated token is a Roblox base
  AND NOT EXISTS (
    SELECT 1
    FROM regexp_split_to_table(lower(base), '[^a-z0-9-]+') AS tok
    WHERE tok <> ''
      AND tok NOT IN ('dispatch', 'erlc-spec', 'customs')
  );
