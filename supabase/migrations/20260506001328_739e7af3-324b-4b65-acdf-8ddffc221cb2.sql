CREATE OR REPLACE FUNCTION public.runtime_claim_next_command(_token text, _worker_id text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tok RECORD;
  _cmd public.bot_commands%ROWTYPE;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  WITH next AS (
    SELECT id
    FROM public.bot_commands
    WHERE status = 'pending'
      AND action <> 'post_message'
      AND (_tok.bot_id IS NULL OR bot_id = _tok.bot_id)
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.bot_commands c
    SET status = 'claimed',
        claimed_at = now(),
        worker_id = COALESCE(_worker_id, c.worker_id),
        updated_at = now()
    FROM next
    WHERE c.id = next.id
    RETURNING c.* INTO _cmd;

  UPDATE public.worker_tokens SET last_used_at = now() WHERE id = _tok.token_id;

  IF _cmd.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'command', NULL);
  END IF;

  RETURN jsonb_build_object('ok', true, 'command', to_jsonb(_cmd));
END;
$$;

UPDATE public.bot_commands
SET status = 'pending',
    claimed_at = NULL,
    worker_id = NULL,
    updated_at = now()
WHERE action = 'post_message'
  AND status = 'claimed';