ALTER TABLE public.dashboard_team
  ADD COLUMN IF NOT EXISTS transfer_bot_ids uuid[];

CREATE OR REPLACE FUNCTION public.team_request_ownership_transfer(_member_id uuid, _bot_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.dashboard_team;
  _token text;
  _valid_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF _bot_ids IS NULL OR array_length(_bot_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'select at least one bot');
  END IF;
  SELECT * INTO _row FROM public.dashboard_team WHERE id = _member_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not found'); END IF;
  IF _row.owner_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not owner');
  END IF;
  IF _row.accepted_at IS NULL OR _row.member_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member has not accepted invite yet');
  END IF;
  -- Restrict to bots actually owned by the caller, in their natural status.
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _valid_ids
    FROM public.bot_orders
   WHERE user_id = auth.uid() AND id = ANY(_bot_ids);
  IF array_length(_valid_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no eligible bots selected');
  END IF;
  _token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  UPDATE public.dashboard_team
     SET transfer_token = _token,
         transfer_requested_at = now(),
         transfer_requested_by = auth.uid(),
         transfer_bot_ids = _valid_ids
   WHERE id = _member_id;
  RETURN jsonb_build_object(
    'ok', true,
    'transfer_token', _token,
    'id', _member_id,
    'member_email', _row.member_email,
    'bot_ids', _valid_ids
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_request_ownership_transfer(uuid, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.team_request_ownership_transfer(uuid, uuid[]) TO authenticated;

-- Drop legacy single-arg version if it still exists.
DROP FUNCTION IF EXISTS public.team_request_ownership_transfer(uuid);

CREATE OR REPLACE FUNCTION public.team_confirm_ownership_transfer(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.dashboard_team;
  _caller_email text;
  _moved_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid token');
  END IF;
  SELECT * INTO _row FROM public.dashboard_team WHERE transfer_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid or expired token');
  END IF;
  IF _row.transfer_requested_at < now() - interval '7 days' THEN
    UPDATE public.dashboard_team
       SET transfer_token = NULL, transfer_requested_at = NULL,
           transfer_requested_by = NULL, transfer_bot_ids = NULL
     WHERE id = _row.id;
    RETURN jsonb_build_object('ok', false, 'error', 'token expired');
  END IF;
  SELECT email INTO _caller_email FROM auth.users WHERE id = auth.uid();
  IF NOT (
    _row.member_user_id = auth.uid()
    OR lower(_row.member_email) = lower(COALESCE(_caller_email, ''))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'this transfer is for a different account');
  END IF;
  IF _row.accepted_at IS NULL OR _row.member_user_id IS NULL THEN
    UPDATE public.dashboard_team
       SET member_user_id = auth.uid(), accepted_at = COALESCE(accepted_at, now())
     WHERE id = _row.id;
  END IF;
  -- Transfer ownership of selected bot_orders to the confirming user.
  IF _row.transfer_bot_ids IS NOT NULL AND array_length(_row.transfer_bot_ids, 1) IS NOT NULL THEN
    UPDATE public.bot_orders
       SET user_id = auth.uid()
     WHERE user_id = _row.owner_user_id
       AND id = ANY(_row.transfer_bot_ids);
    GET DIAGNOSTICS _moved_count = ROW_COUNT;
  ELSE
    _moved_count := 0;
  END IF;
  -- Clear transfer markers; leave team roles untouched (per-bot transfer model).
  UPDATE public.dashboard_team
     SET transfer_token = NULL,
         transfer_requested_at = NULL,
         transfer_requested_by = NULL,
         transfer_bot_ids = NULL
   WHERE id = _row.id;
  RETURN jsonb_build_object(
    'ok', true,
    'owner_user_id', _row.owner_user_id,
    'previous_owner_email', (SELECT email FROM auth.users WHERE id = _row.owner_user_id),
    'transfer_id', _row.id,
    'bots_transferred', _moved_count
  );
END;
$$;