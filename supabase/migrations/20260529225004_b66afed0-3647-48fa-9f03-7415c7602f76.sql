DROP FUNCTION IF EXISTS public.claim_post_message(text, uuid);

CREATE OR REPLACE FUNCTION public.claim_post_message(_worker_id text DEFAULT NULL::text, _bot_id uuid DEFAULT NULL::uuid)
RETURNS SETOF public.bot_commands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
    WHERE action = 'post_message'
      AND status = 'pending'
      AND (_bot_id IS NULL OR bot_id = _bot_id)
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO claimed;

  IF claimed.id IS NOT NULL THEN
    RETURN NEXT claimed;
  END IF;
  RETURN;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_post_message(text, uuid) TO anon, authenticated, service_role;