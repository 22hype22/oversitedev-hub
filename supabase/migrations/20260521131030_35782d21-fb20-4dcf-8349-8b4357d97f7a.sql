CREATE OR REPLACE FUNCTION public.update_bot_token_pool_entry(
  _id uuid,
  _bot_username text DEFAULT NULL,
  _status text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _assigned_bot_id uuid DEFAULT NULL,
  _client_id text DEFAULT NULL,
  _token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _admin UUID := auth.uid();
  _last_four TEXT;
  _enc BYTEA;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only admins.');
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('available','assigned','retired') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid status.');
  END IF;
  IF _bot_username IS NOT NULL AND (length(trim(_bot_username)) = 0 OR length(_bot_username) > 100) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid bot username.');
  END IF;
  IF _client_id IS NOT NULL THEN
    IF length(trim(_client_id)) = 0 OR length(_client_id) > 100 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid client ID.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.bot_token_pool WHERE client_id = trim(_client_id) AND id <> _id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Another pool entry already uses that client ID.');
    END IF;
  END IF;
  IF _token IS NOT NULL THEN
    IF length(_token) < 20 OR length(_token) > 500 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid bot token.');
    END IF;
    _last_four := right(_token, 4);
    _enc := extensions.pgp_sym_encrypt(_token, public._bot_secrets_key());
  END IF;

  UPDATE public.bot_token_pool
     SET bot_username = COALESCE(_bot_username, bot_username),
         client_id = COALESCE(trim(_client_id), client_id),
         token_encrypted = COALESCE(_enc, token_encrypted),
         token_last_four = COALESCE(_last_four, token_last_four),
         status = COALESCE(_status, status),
         notes = COALESCE(_notes, notes),
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
      'rotated_token', _token IS NOT NULL,
      'changed_client_id', _client_id IS NOT NULL,
      'changed_username', _bot_username IS NOT NULL,
      'status', _status
    ));

  RETURN jsonb_build_object('ok', true, 'rotated_token', _token IS NOT NULL);
END;
$function$;