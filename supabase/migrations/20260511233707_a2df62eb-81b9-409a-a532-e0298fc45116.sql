DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bot_runtime_status_bot_id_key'
      AND conrelid = 'public.bot_runtime_status'::regclass
  ) THEN
    ALTER TABLE public.bot_runtime_status
      ADD CONSTRAINT bot_runtime_status_bot_id_key UNIQUE (bot_id);
  END IF;
END $$;

DROP POLICY IF EXISTS "Worker heartbeat can insert bot status" ON public.bot_runtime_status;
DROP POLICY IF EXISTS "Worker heartbeat can update bot status" ON public.bot_runtime_status;

CREATE POLICY "Worker heartbeat can insert bot status"
ON public.bot_runtime_status
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bot_orders o
    WHERE o.id = bot_runtime_status.bot_id
      AND o.user_id = bot_runtime_status.user_id
  )
);

CREATE POLICY "Worker heartbeat can update bot status"
ON public.bot_runtime_status
FOR UPDATE
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.bot_orders o
    WHERE o.id = bot_runtime_status.bot_id
      AND o.user_id = bot_runtime_status.user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bot_orders o
    WHERE o.id = bot_runtime_status.bot_id
      AND o.user_id = bot_runtime_status.user_id
  )
);

GRANT INSERT, UPDATE ON public.bot_runtime_status TO anon;