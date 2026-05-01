-- Extend update_bot_token_pool_entry to support editing client_id and rotating the token.
-- The token itself can be replaced but never read back through this RPC.
CREATE OR REPLACE FUNCTION public.update_bot_token_pool_entry(
  _id uuid,
  _bot_username text DEFAULT NULL::text,
  _status text DEFAULT NULL::text,
  _notes text DEFAULT NULL::text,
  _assigned_bot_id uuid DEFAULT NULL::uuid,
  _client_id text DEFAULT NULL::text,
  _token text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _admin UUID := auth.uid();
  _new_enc BYTEA;
  _new_last_four TEXT;
  _trimmed_client_id TEXT;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only admins.');
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('available','assigned','retired') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid status.');
  END IF;

  IF _bot_username IS NOT NULL AND (length(trim(_bot_username)) = 0 OR length(_bot_username) > 100) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Provide a valid bot username.');
  END IF;

  IF _client_id IS NOT NULL THEN
    _trimmed_client_id := trim(_client_id);
    IF length(_trimmed_client_id) = 0 OR length(_trimmed_client_id) > 100 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Provide a valid client ID.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.bot_token_pool WHERE client_id = _trimmed_client_id AND id <> _id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'A token with that client ID already exists in the pool.');
    END IF;
  END IF;

  IF _notes IS NOT NULL AND length(_notes) > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Notes too long.');
  END IF;

  IF _token IS NOT NULL THEN
    IF length(_token) < 20 OR length(_token) > 500 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Provide a valid bot token.');
    END IF;
    _new_enc := extensions.pgp_sym_encrypt(_token, public._bot_secrets_key());
    _new_last_four := right(_token, 4);
  END IF;

  UPDATE public.bot_token_pool
     SET bot_username = COALESCE(NULLIF(trim(COALESCE(_bot_username, '')), ''), bot_username),
         status = COALESCE(_status, status),
         notes = COALESCE(_notes, notes),
         client_id = COALESCE(_trimmed_client_id, client_id),
         token_encrypted = COALESCE(_new_enc, token_encrypted),
         token_last_four = COALESCE(_new_last_four, token_last_four),
         assigned_bot_id = CASE
           WHEN _assigned_bot_id IS NOT NULL THEN _assigned_bot_id
           WHEN _status = 'available' OR _status = 'retired' THEN NULL
           ELSE assigned_bot_id
         END,
         assigned_at = CASE
           WHEN _assigned_bot_id IS NOT NULL THEN now()
           WHEN _status = 'available' OR _status = 'retired' THEN NULL
           ELSE assigned_at
         END,
         updated_at = now()
   WHERE id = _id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pool entry not found.');
  END IF;

  PERFORM public.log_admin_action('update_bot_token_pool_entry', NULL, NULL,
    jsonb_build_object(
      'pool_id', _id,
      'status', _status,
      'assigned_bot_id', _assigned_bot_id,
      'token_rotated', _token IS NOT NULL,
      'client_id_changed', _client_id IS NOT NULL,
      'username_changed', _bot_username IS NOT NULL
    ));

  RETURN jsonb_build_object('ok', true);
END;
$function$;