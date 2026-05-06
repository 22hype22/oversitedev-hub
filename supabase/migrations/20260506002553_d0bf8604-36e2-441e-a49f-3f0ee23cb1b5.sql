-- Allow the Discord bot, using the anon key, to see only pending post_message commands.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bot_commands'
      AND policyname = 'Anon can read pending post_message commands'
  ) THEN
    CREATE POLICY "Anon can read pending post_message commands"
    ON public.bot_commands
    FOR SELECT
    TO public
    USING (action = 'post_message'::text AND status = 'pending'::text);
  END IF;
END $$;

-- Optional atomic claim path for the Discord bot, limited to post_message commands only.
CREATE OR REPLACE FUNCTION public.claim_post_message(_worker_id text DEFAULT NULL)
RETURNS public.bot_commands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.bot_commands%ROWTYPE;
BEGIN
  UPDATE public.bot_commands
  SET
    status = 'claimed',
    worker_id = COALESCE(NULLIF(_worker_id, ''), 'discord-bot'),
    claimed_at = now(),
    updated_at = now()
  WHERE id = (
    SELECT id
    FROM public.bot_commands
    WHERE action = 'post_message'::text
      AND status = 'pending'::text
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO claimed;

  RETURN claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_post_message(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_post_message(text) TO anon, authenticated;