
CREATE TABLE IF NOT EXISTS public.dashboard_billing_info (
  owner_user_id uuid PRIMARY KEY,
  billing_name text,
  company text,
  billing_email text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  needs_update boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_billing_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can view own billing" ON public.dashboard_billing_info;
CREATE POLICY "Owner can view own billing"
  ON public.dashboard_billing_info FOR SELECT
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Owner can insert own billing" ON public.dashboard_billing_info;
CREATE POLICY "Owner can insert own billing"
  ON public.dashboard_billing_info FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Owner can update own billing" ON public.dashboard_billing_info;
CREATE POLICY "Owner can update own billing"
  ON public.dashboard_billing_info FOR UPDATE
  USING (auth.uid() = owner_user_id);

-- Update confirm transfer RPC to mark new owner's billing as needing update.
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
  UPDATE public.dashboard_team SET role = 'co_owner'
   WHERE owner_user_id = _row.owner_user_id AND role = 'owner';
  UPDATE public.dashboard_team
     SET role = 'owner',
         transfer_token = NULL,
         transfer_requested_at = NULL,
         transfer_requested_by = NULL
   WHERE id = _row.id;

  -- Mark the new owner as needing to (re)fill billing info.
  INSERT INTO public.dashboard_billing_info (owner_user_id, needs_update)
  VALUES (auth.uid(), true)
  ON CONFLICT (owner_user_id) DO UPDATE SET needs_update = true, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'owner_user_id', _row.owner_user_id, 'needs_billing', true);
END;
$$;
