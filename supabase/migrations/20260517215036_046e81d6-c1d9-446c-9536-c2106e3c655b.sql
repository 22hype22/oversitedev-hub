
ALTER TABLE public.dashboard_team
  ADD COLUMN IF NOT EXISTS transfer_token text,
  ADD COLUMN IF NOT EXISTS transfer_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS transfer_requested_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_team_transfer_token_idx
  ON public.dashboard_team(transfer_token) WHERE transfer_token IS NOT NULL;

-- Owner initiates a transfer: stores a token on the target member row,
-- returns the token so the edge function can email a confirmation link.
CREATE OR REPLACE FUNCTION public.team_request_ownership_transfer(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.dashboard_team;
  _token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  SELECT * INTO _row FROM public.dashboard_team WHERE id = _member_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not found'); END IF;
  IF _row.owner_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not owner');
  END IF;
  IF _row.accepted_at IS NULL OR _row.member_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member has not accepted invite yet');
  END IF;
  _token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  UPDATE public.dashboard_team
     SET transfer_token = _token,
         transfer_requested_at = now(),
         transfer_requested_by = auth.uid()
   WHERE id = _member_id;
  RETURN jsonb_build_object('ok', true, 'transfer_token', _token, 'id', _member_id, 'member_email', _row.member_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_request_ownership_transfer(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.team_request_ownership_transfer(uuid) TO authenticated;

-- Owner cancels a pending transfer.
CREATE OR REPLACE FUNCTION public.team_cancel_ownership_transfer(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  UPDATE public.dashboard_team
     SET transfer_token = NULL, transfer_requested_at = NULL, transfer_requested_by = NULL
   WHERE id = _member_id AND owner_user_id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_cancel_ownership_transfer(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.team_cancel_ownership_transfer(uuid) TO authenticated;

-- Target member confirms transfer using the emailed token. Demotes current
-- owner to co_owner and promotes target to owner. The caller must be signed
-- in as the target member (matched by user id or email).
CREATE OR REPLACE FUNCTION public.team_confirm_ownership_transfer(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.dashboard_team;
  _caller_email text;
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
  -- Expire after 7 days
  IF _row.transfer_requested_at < now() - interval '7 days' THEN
    UPDATE public.dashboard_team
       SET transfer_token = NULL, transfer_requested_at = NULL, transfer_requested_by = NULL
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
  -- Swap roles
  UPDATE public.dashboard_team SET role = 'co_owner'
   WHERE owner_user_id = _row.owner_user_id AND role = 'owner';
  UPDATE public.dashboard_team
     SET role = 'owner',
         transfer_token = NULL,
         transfer_requested_at = NULL,
         transfer_requested_by = NULL
   WHERE id = _row.id;
  RETURN jsonb_build_object('ok', true, 'owner_user_id', _row.owner_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_confirm_ownership_transfer(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.team_confirm_ownership_transfer(text) TO authenticated;
