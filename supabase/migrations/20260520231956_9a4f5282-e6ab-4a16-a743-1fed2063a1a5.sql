CREATE OR REPLACE FUNCTION public.runtime_resolve_bot_token(_bot_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _token text;
  _enc bytea;
BEGIN
  -- 1) bot_secrets (worker-managed bots)
  SELECT extensions.pgp_sym_decrypt(value_encrypted, public._bot_secrets_key())
    INTO _token
  FROM public.bot_secrets
  WHERE bot_id = _bot_id AND key = 'DISCORD_TOKEN'
  LIMIT 1;
  IF _token IS NOT NULL AND length(_token) > 0 THEN
    RETURN _token;
  END IF;

  -- 2) bot_orders.bot_token (manually set token)
  SELECT bot_token INTO _token
  FROM public.bot_orders
  WHERE id = _bot_id
  LIMIT 1;
  IF _token IS NOT NULL AND length(_token) > 0 THEN
    RETURN _token;
  END IF;

  -- 3) bot_token_pool assigned to this bot (auto-deploy claimed)
  SELECT token_encrypted INTO _enc
  FROM public.bot_token_pool
  WHERE assigned_bot_id = _bot_id
  LIMIT 1;
  IF _enc IS NOT NULL THEN
    RETURN extensions.pgp_sym_decrypt(_enc, public._bot_secrets_key());
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.runtime_resolve_bot_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_resolve_bot_token(uuid) TO service_role;