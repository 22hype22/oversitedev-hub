CREATE OR REPLACE FUNCTION public.claim_post_message(_worker_id text DEFAULT NULL, _bot_id uuid DEFAULT NULL)
RETURNS public.bot_commands
LANGUAGE plpgsql
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
      AND (_bot_id IS NULL OR bot_id = _bot_id)
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO claimed;

  RETURN claimed;
END;
$$;