DROP FUNCTION IF EXISTS public.runtime_get_bot_secret(text, uuid, text);

CREATE OR REPLACE FUNCTION public.runtime_get_bot_secret(
  _token text,
  _bot_id uuid,
  _key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _tok record;
  _stored bytea;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN
    RAISE EXCEPTION 'token_bot_mismatch';
  END IF;

  SELECT value_encrypted INTO _stored
  FROM public.bot_secrets
  WHERE bot_id = _bot_id
    AND key = upper(_key)
  LIMIT 1;

  IF _stored IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN extensions.pgp_sym_decrypt(_stored, public._bot_secrets_key());
END;
$$;

REVOKE ALL ON FUNCTION public.runtime_get_bot_secret(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_get_bot_secret(text, uuid, text) TO anon, authenticated;