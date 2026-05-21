
ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS activity_type text,
  ADD COLUMN IF NOT EXISTS activity_text text;

ALTER TABLE public.bot_orders
  DROP CONSTRAINT IF EXISTS bot_orders_activity_type_check;
ALTER TABLE public.bot_orders
  ADD CONSTRAINT bot_orders_activity_type_check
  CHECK (activity_type IS NULL OR activity_type = ANY (ARRAY[
    'playing'::text, 'watching'::text, 'listening'::text,
    'competing'::text, 'streaming'::text
  ]));

ALTER TABLE public.bot_commands DROP CONSTRAINT IF EXISTS bot_commands_action_check;
ALTER TABLE public.bot_commands ADD CONSTRAINT bot_commands_action_check
  CHECK (action = ANY (ARRAY[
    'start'::text, 'stop'::text, 'restart'::text, 'update'::text, 'shutdown'::text,
    'list_channels'::text, 'list_guilds'::text, 'list_roles'::text,
    'apply_config'::text, 'post_message'::text,
    'start_giveaway'::text, 'setup_stats'::text,
    'set_status'::text
  ]));

CREATE OR REPLACE FUNCTION public.runtime_load_bot_config(_token text, _bot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _tok RECORD; _row public.bot_orders%ROWTYPE;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN RAISE EXCEPTION 'token_bot_mismatch'; END IF;
  SELECT * INTO _row FROM public.bot_orders WHERE id = _bot_id;
  IF _row.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'config', NULL); END IF;
  RETURN jsonb_build_object('ok', true, 'config', jsonb_build_object(
    'id', _row.id, 'user_id', _row.user_id, 'bot_name', _row.bot_name,
    'base', _row.base, 'addons', _row.addons, 'monthly_hosting', _row.monthly_hosting,
    'status', _row.status, 'notes', _row.notes, 'icon_url', _row.icon_url,
    'bot_description', _row.bot_description,
    'activity_type', _row.activity_type,
    'activity_text', _row.activity_text));
END; $function$;
