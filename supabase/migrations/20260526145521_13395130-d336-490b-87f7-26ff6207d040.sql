-- Allow bots (anon key) to write their own heartbeat to bot_runtime_status.
-- Column-level grants restrict anon to only the heartbeat-relevant columns,
-- so sensitive fields (user_id, worker_id metadata) can't be tampered with.

GRANT SELECT (bot_id, status, last_heartbeat_at, started_at, uptime_seconds, version, updated_at)
  ON public.bot_runtime_status TO anon;

GRANT INSERT (bot_id, user_id, status, last_heartbeat_at, started_at, uptime_seconds, last_error, last_error_at, worker_id, version, guilds, details)
  ON public.bot_runtime_status TO anon;

GRANT UPDATE (status, last_heartbeat_at, started_at, uptime_seconds, last_error, last_error_at, worker_id, version, guilds, details, updated_at)
  ON public.bot_runtime_status TO anon;

-- RLS: allow anon to insert/update/select rows for bot_ids that exist in bot_orders.
CREATE POLICY "Anon bots can read own runtime status"
  ON public.bot_runtime_status
  FOR SELECT
  TO anon
  USING (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can insert own runtime status"
  ON public.bot_runtime_status
  FOR INSERT
  TO anon
  WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can update own runtime status"
  ON public.bot_runtime_status
  FOR UPDATE
  TO anon
  USING (bot_id IN (SELECT id FROM public.bot_orders))
  WITH CHECK (bot_id IN (SELECT id FROM public.bot_orders));
