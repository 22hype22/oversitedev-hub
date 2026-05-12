CREATE OR REPLACE FUNCTION public.bot_runtime_status_can_write(_bot_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bot_orders o
    WHERE o.id = _bot_id
      AND (_user_id IS NULL OR o.user_id = _user_id)
  );
$$;

REVOKE ALL ON FUNCTION public.bot_runtime_status_can_write(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.bot_runtime_status_can_write(uuid, uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Worker heartbeat can insert bot status" ON public.bot_runtime_status;
DROP POLICY IF EXISTS "Worker heartbeat can update bot status" ON public.bot_runtime_status;

CREATE POLICY "Worker heartbeat can insert bot status"
ON public.bot_runtime_status
FOR INSERT
TO anon
WITH CHECK (public.bot_runtime_status_can_write(bot_id, user_id));

CREATE POLICY "Worker heartbeat can update bot status"
ON public.bot_runtime_status
FOR UPDATE
TO anon
USING (public.bot_runtime_status_can_write(bot_id, user_id))
WITH CHECK (public.bot_runtime_status_can_write(bot_id, user_id));