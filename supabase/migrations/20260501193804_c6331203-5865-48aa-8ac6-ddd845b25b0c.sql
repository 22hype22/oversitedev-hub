CREATE OR REPLACE FUNCTION public._worker_token_lookup(_token text)
RETURNS TABLE(token_id uuid, bot_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _hash TEXT;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN;
  END IF;
  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');
  RETURN QUERY
  SELECT wt.id, wt.bot_id
  FROM public.worker_tokens wt
  WHERE wt.token_hash = _hash AND wt.revoked_at IS NULL;
END;
$function$;