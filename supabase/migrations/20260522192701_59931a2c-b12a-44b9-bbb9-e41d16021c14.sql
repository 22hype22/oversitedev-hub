-- 1. bot_commands: remove blanket anon read/update policies (action-scoped policies remain)
DROP POLICY IF EXISTS "Anon can read bot_commands" ON public.bot_commands;
DROP POLICY IF EXISTS "Anon can update bot_commands" ON public.bot_commands;

-- 2. bot_config: replace public SELECT with service_role only (owners/teams keep their existing policies)
DROP POLICY IF EXISTS "Service can read bot config" ON public.bot_config;
CREATE POLICY "Service role can read bot config"
  ON public.bot_config
  FOR SELECT
  TO service_role
  USING (true);

-- 3. bot_addon_state: same treatment
DROP POLICY IF EXISTS "Service can read bot addon state" ON public.bot_addon_state;
CREATE POLICY "Service role can read bot addon state"
  ON public.bot_addon_state
  FOR SELECT
  TO service_role
  USING (true);

-- 4. bot_runtime_status_can_write: require non-null _user_id to prevent anon spoofing
CREATE OR REPLACE FUNCTION public.bot_runtime_status_can_write(_bot_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.bot_orders o
       WHERE o.id = _bot_id
         AND o.user_id = _user_id
     );
$$;