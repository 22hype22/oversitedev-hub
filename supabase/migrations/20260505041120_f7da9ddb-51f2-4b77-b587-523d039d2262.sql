
ALTER TABLE public.bot_commands DROP CONSTRAINT IF EXISTS bot_commands_action_check;
ALTER TABLE public.bot_commands ADD CONSTRAINT bot_commands_action_check
  CHECK (action = ANY (ARRAY['start','stop','restart','update','list_channels','list_guilds','list_roles','apply_config','post_message']));

CREATE OR REPLACE FUNCTION public.enqueue_post_message(_bot_id uuid, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _bot_owner uuid;
  _id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
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
  VALUES (_bot_id, _bot_owner, _user_id, 'post_message', _payload)
  RETURNING id INTO _id;

  RETURN jsonb_build_object('ok', true, 'id', _id);
END;
$$;
