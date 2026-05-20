
CREATE OR REPLACE FUNCTION public.claim_pool_token_for_deploy(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _pool_row public.bot_token_pool%ROWTYPE;
  _token_plain TEXT;
BEGIN
  IF _order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_id required');
  END IF;

  -- If this order already has a pool token assigned, reuse it (idempotent retries).
  SELECT * INTO _pool_row
  FROM public.bot_token_pool
  WHERE assigned_bot_id = _order_id
  LIMIT 1;

  IF _pool_row.id IS NULL THEN
    SELECT * INTO _pool_row
    FROM public.bot_token_pool
    WHERE status = 'available'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF _pool_row.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'pool_empty');
    END IF;

    UPDATE public.bot_token_pool
    SET status = 'assigned',
        assigned_at = now(),
        assigned_bot_id = _order_id,
        updated_at = now()
    WHERE id = _pool_row.id;
  END IF;

  _token_plain := extensions.pgp_sym_decrypt(_pool_row.token_encrypted, public._bot_secrets_key());

  RETURN jsonb_build_object(
    'ok', true,
    'pool_id', _pool_row.id,
    'token', _token_plain,
    'client_id', _pool_row.client_id,
    'bot_username', _pool_row.bot_username
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pool_token_for_deploy(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pool_token_for_deploy(UUID) TO service_role;
