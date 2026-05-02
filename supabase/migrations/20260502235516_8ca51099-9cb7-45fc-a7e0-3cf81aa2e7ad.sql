CREATE OR REPLACE FUNCTION public.enqueue_apply_config(_bot_id uuid, _feature text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _id UUID;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;
  IF _feature IS NULL OR length(_feature) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing feature.');
  END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.');
  END IF;
  IF _bot_owner <> _user_id
     AND NOT public.has_role(_user_id, 'admin'::app_role)
     AND NOT public.has_support_access(_user_id, _bot_owner) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed.');
  END IF;

  INSERT INTO public.bot_commands (bot_id, user_id, requested_by, action, payload)
  VALUES (_bot_id, _bot_owner, _user_id, 'apply_config', jsonb_build_object('feature', _feature))
  RETURNING id INTO _id;

  RETURN jsonb_build_object('ok', true, 'id', _id);
END;
$function$;