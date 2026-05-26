
-- bot_commands: remove anon SELECT/UPDATE policies
DROP POLICY IF EXISTS "Anon can read apply_config commands" ON public.bot_commands;
DROP POLICY IF EXISTS "Anon can read pending post_message commands" ON public.bot_commands;
DROP POLICY IF EXISTS "Anon can read post_message commands" ON public.bot_commands;
DROP POLICY IF EXISTS "Anon can read send_dm commands" ON public.bot_commands;
DROP POLICY IF EXISTS "Anon can update apply_config commands" ON public.bot_commands;
DROP POLICY IF EXISTS "Anon can update post_message commands" ON public.bot_commands;
DROP POLICY IF EXISTS "Anon can update send_dm commands" ON public.bot_commands;

-- utility_bot_dm_state: remove fully-public ALL policy
DROP POLICY IF EXISTS "Anon manages dm state" ON public.utility_bot_dm_state;

-- bot_runtime_status: remove anon write/select policies (worker must use service_role)
DROP POLICY IF EXISTS "Worker heartbeat can insert bot status" ON public.bot_runtime_status;
DROP POLICY IF EXISTS "Worker heartbeat can update bot status" ON public.bot_runtime_status;
DROP POLICY IF EXISTS "Worker heartbeat can resolve bot status upsert" ON public.bot_runtime_status;

-- discount_codes: remove broad authenticated SELECT
DROP POLICY IF EXISTS "Anyone signed in can read active codes" ON public.discount_codes;

-- Targeted RPC: validate a single discount code by exact match (case-insensitive)
CREATE OR REPLACE FUNCTION public.validate_discount_code(_code text)
RETURNS TABLE (
  code text,
  kind text,
  value numeric,
  max_uses integer,
  times_used integer,
  expires_at timestamptz,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.code, d.kind, d.value, d.max_uses, d.times_used, d.expires_at, d.is_active
  FROM public.discount_codes d
  WHERE lower(d.code) = lower(_code)
    AND d.is_active = true
    AND (d.expires_at IS NULL OR d.expires_at > now())
    AND (d.max_uses IS NULL OR d.times_used < d.max_uses)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validate_discount_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(text) TO anon, authenticated;

-- Targeted RPC: increment usage on a single discount code
CREATE OR REPLACE FUNCTION public.increment_discount_code_usage(_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.discount_codes
  SET times_used = COALESCE(times_used, 0) + 1
  WHERE lower(code) = lower(_code)
    AND is_active = true;
$$;

REVOKE ALL ON FUNCTION public.increment_discount_code_usage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_discount_code_usage(text) TO authenticated;

-- billing_override_code: add explicit service-role-only policy (RLS was on, no policies)
CREATE POLICY "Service role manages billing override code"
ON public.billing_override_code
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
