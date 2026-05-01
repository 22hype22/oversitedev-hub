
CREATE OR REPLACE FUNCTION public.claim_bot_token_from_pool(_bot_order_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _pool_id UUID;
  _token TEXT;
  _client_id TEXT;
  _bot_username TEXT;
  _bot_owner UUID;
  _last_four TEXT;
BEGIN
  -- Service role only
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Verify bot order exists, get owner
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_order_id;
  IF _bot_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bot order not found.');
  END IF;

  -- Atomically claim the oldest available token
  SELECT id, client_id, bot_username
    INTO _pool_id, _client_id, _bot_username
    FROM public.bot_token_pool
   WHERE status = 'available'
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF _pool_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No available tokens in pool.');
  END IF;

  -- Decrypt the token
  SELECT extensions.pgp_sym_decrypt(token_encrypted, public._bot_secrets_key())
    INTO _token
    FROM public.bot_token_pool
   WHERE id = _pool_id;

  _last_four := CASE WHEN length(_token) >= 4 THEN right(_token, 4) ELSE repeat('*', length(_token)) END;

  -- Mark the pool entry as assigned
  UPDATE public.bot_token_pool
     SET status = 'assigned',
         assigned_bot_id = _bot_order_id,
         assigned_at = now(),
         updated_at = now()
   WHERE id = _pool_id;

  -- Store as the bot's DISCORD_TOKEN secret
  INSERT INTO public.bot_secrets (bot_id, user_id, key, value_encrypted, last_four)
  VALUES (
    _bot_order_id,
    _bot_owner,
    'DISCORD_TOKEN',
    extensions.pgp_sym_encrypt(_token, public._bot_secrets_key()),
    _last_four
  )
  ON CONFLICT (bot_id, key) DO UPDATE
    SET value_encrypted = EXCLUDED.value_encrypted,
        last_four = EXCLUDED.last_four,
        updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'pool_id', _pool_id,
    'client_id', _client_id,
    'bot_username', _bot_username
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_bot_token_from_pool(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bot_token_from_pool(UUID) TO service_role;
