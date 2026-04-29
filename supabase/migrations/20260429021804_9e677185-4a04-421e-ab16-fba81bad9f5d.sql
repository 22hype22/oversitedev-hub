-- =============================================================
-- 1) Tables
-- =============================================================
CREATE TABLE public.support_access_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  redeemed_by_admin_id UUID,
  redeemed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_codes_owner ON public.support_access_codes(owner_user_id);
CREATE INDEX idx_support_codes_code ON public.support_access_codes(code);

ALTER TABLE public.support_access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their own codes"
  ON public.support_access_codes FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);
CREATE POLICY "Admins view all codes"
  ON public.support_access_codes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.support_access_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID NOT NULL REFERENCES public.support_access_codes(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_support_grants_admin ON public.support_access_grants(admin_user_id);
CREATE INDEX idx_support_grants_owner ON public.support_access_grants(owner_user_id);

ALTER TABLE public.support_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view grants on their account"
  ON public.support_access_grants FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);
CREATE POLICY "Admins view their own grants"
  ON public.support_access_grants FOR SELECT TO authenticated
  USING (auth.uid() = admin_user_id);

CREATE TABLE public.support_access_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID NOT NULL REFERENCES public.support_access_grants(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  bot_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_audit_owner ON public.support_access_audit(owner_user_id);
CREATE INDEX idx_support_audit_admin ON public.support_access_audit(admin_user_id);
CREATE INDEX idx_support_audit_grant ON public.support_access_audit(grant_id);

ALTER TABLE public.support_access_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view audit on their account"
  ON public.support_access_audit FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);
CREATE POLICY "Admins view their own audit entries"
  ON public.support_access_audit FOR SELECT TO authenticated
  USING (auth.uid() = admin_user_id);

-- =============================================================
-- 2) Helper: does this admin have an active grant for this owner?
-- =============================================================
CREATE OR REPLACE FUNCTION public.has_support_access(_admin_id UUID, _owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_access_grants g
    WHERE g.admin_user_id = _admin_id
      AND g.owner_user_id = _owner_id
      AND g.revoked_at IS NULL
      AND g.expires_at > now()
      AND public.has_role(_admin_id, 'admin'::app_role)
  );
$$;

-- =============================================================
-- 3) Owner-facing: create a code
-- =============================================================
CREATE OR REPLACE FUNCTION public.create_support_access_code(
  _expires_in_hours INTEGER,
  _notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _code TEXT;
  _expires TIMESTAMPTZ;
  _id UUID;
  _seg1 TEXT;
  _seg2 TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;
  IF _expires_in_hours IS NULL OR _expires_in_hours < 1 OR _expires_in_hours > 24 * 30 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Expiry must be between 1 hour and 30 days.');
  END IF;
  IF _notes IS NOT NULL AND length(_notes) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Notes too long.');
  END IF;

  -- Generate a readable code: SUP-XXXX-XXXX (no 0/O/1/I/L)
  _seg1 := upper(translate(encode(extensions.gen_random_bytes(3), 'base32'), '01OILoil', ''));
  _seg2 := upper(translate(encode(extensions.gen_random_bytes(3), 'base32'), '01OILoil', ''));
  _code := 'SUP-' || substring(_seg1, 1, 4) || '-' || substring(_seg2, 1, 4);
  _expires := now() + (_expires_in_hours || ' hours')::interval;

  INSERT INTO public.support_access_codes (owner_user_id, code, expires_at, notes)
  VALUES (_user_id, _code, _expires, _notes)
  RETURNING id INTO _id;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'code', _code, 'expires_at', _expires);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_support_access_code(INTEGER, TEXT) TO authenticated;

-- =============================================================
-- 4) Admin-facing: redeem a code
-- =============================================================
CREATE OR REPLACE FUNCTION public.redeem_support_access_code(_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id UUID := auth.uid();
  _row public.support_access_codes%ROWTYPE;
  _grant_id UUID;
BEGIN
  IF _admin_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;
  IF NOT public.has_role(_admin_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only admins can redeem support codes.');
  END IF;
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter a code.');
  END IF;

  SELECT * INTO _row FROM public.support_access_codes WHERE upper(code) = upper(trim(_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code not found.');
  END IF;
  IF _row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code was revoked by the owner.');
  END IF;
  IF _row.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code has expired.');
  END IF;
  IF _row.redeemed_at IS NOT NULL AND _row.redeemed_by_admin_id <> _admin_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This code was already used by another admin.');
  END IF;

  -- Mark redeemed (idempotent for same admin)
  UPDATE public.support_access_codes
     SET redeemed_at = COALESCE(redeemed_at, now()),
         redeemed_by_admin_id = _admin_id
   WHERE id = _row.id;

  -- Reuse existing active grant if one exists, otherwise create one
  SELECT id INTO _grant_id FROM public.support_access_grants
   WHERE code_id = _row.id AND admin_user_id = _admin_id
     AND revoked_at IS NULL AND expires_at > now()
   LIMIT 1;

  IF _grant_id IS NULL THEN
    INSERT INTO public.support_access_grants
      (code_id, admin_user_id, owner_user_id, expires_at)
    VALUES (_row.id, _admin_id, _row.owner_user_id, _row.expires_at)
    RETURNING id INTO _grant_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'grant_id', _grant_id,
    'owner_user_id', _row.owner_user_id,
    'expires_at', _row.expires_at
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_support_access_code(TEXT) TO authenticated;

-- =============================================================
-- 5) Owner-facing: revoke
-- =============================================================
CREATE OR REPLACE FUNCTION public.revoke_support_access_code(_code_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _owner UUID;
BEGIN
  SELECT owner_user_id INTO _owner FROM public.support_access_codes WHERE id = _code_id;
  IF _owner IS NULL OR _owner <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed.');
  END IF;
  UPDATE public.support_access_codes SET revoked_at = COALESCE(revoked_at, now()) WHERE id = _code_id;
  UPDATE public.support_access_grants SET revoked_at = COALESCE(revoked_at, now())
   WHERE code_id = _code_id AND revoked_at IS NULL;
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_support_access_code(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_support_access_grant(_grant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _owner UUID;
BEGIN
  SELECT owner_user_id INTO _owner FROM public.support_access_grants WHERE id = _grant_id;
  IF _owner IS NULL OR _owner <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed.');
  END IF;
  UPDATE public.support_access_grants SET revoked_at = COALESCE(revoked_at, now()) WHERE id = _grant_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.revoke_support_access_grant(UUID) TO authenticated;

-- =============================================================
-- 6) Audit logger
-- =============================================================
CREATE OR REPLACE FUNCTION public.log_support_action(
  _grant_id UUID,
  _action TEXT,
  _bot_id UUID DEFAULT NULL,
  _details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _owner UUID;
BEGIN
  IF _admin IS NULL THEN RETURN; END IF;
  SELECT owner_user_id INTO _owner FROM public.support_access_grants
   WHERE id = _grant_id AND admin_user_id = _admin
     AND revoked_at IS NULL AND expires_at > now();
  IF _owner IS NULL THEN RETURN; END IF;
  INSERT INTO public.support_access_audit (grant_id, admin_user_id, owner_user_id, bot_id, action, details)
  VALUES (_grant_id, _admin, _owner, _bot_id, _action, _details);
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_support_action(UUID, TEXT, UUID, JSONB) TO authenticated;

-- =============================================================
-- 7) Extend RLS on bot tables to allow active support grants
-- =============================================================
-- bot_orders
CREATE POLICY "Support: view bot orders"
  ON public.bot_orders FOR SELECT TO authenticated
  USING (public.has_support_access(auth.uid(), user_id));
CREATE POLICY "Support: update bot orders"
  ON public.bot_orders FOR UPDATE TO authenticated
  USING (public.has_support_access(auth.uid(), user_id))
  WITH CHECK (public.has_support_access(auth.uid(), user_id));

-- bot_secrets (owners can view rows, support can too — values still encrypted)
CREATE POLICY "Support: view bot secret rows"
  ON public.bot_secrets FOR SELECT TO authenticated
  USING (public.has_support_access(auth.uid(), user_id));

-- bot_credits
CREATE POLICY "Support: view bot credits"
  ON public.bot_credits FOR SELECT TO authenticated
  USING (public.has_support_access(auth.uid(), user_id));

-- bot_pending_discounts
CREATE POLICY "Support: view pending discounts"
  ON public.bot_pending_discounts FOR SELECT TO authenticated
  USING (public.has_support_access(auth.uid(), user_id));

-- bot_free_periods
CREATE POLICY "Support: view free periods"
  ON public.bot_free_periods FOR SELECT TO authenticated
  USING (public.has_support_access(auth.uid(), user_id));

-- bot_dashboard_redemptions
CREATE POLICY "Support: view redemption audit"
  ON public.bot_dashboard_redemptions FOR SELECT TO authenticated
  USING (public.has_support_access(auth.uid(), user_id));

-- bot_free_period_redemptions
CREATE POLICY "Support: view free period redemptions"
  ON public.bot_free_period_redemptions FOR SELECT TO authenticated
  USING (public.has_support_access(auth.uid(), user_id));

-- dashboard_addon_order
CREATE POLICY "Support: view addon order"
  ON public.dashboard_addon_order FOR SELECT TO authenticated
  USING (public.has_support_access(auth.uid(), user_id));
CREATE POLICY "Support: update addon order"
  ON public.dashboard_addon_order FOR UPDATE TO authenticated
  USING (public.has_support_access(auth.uid(), user_id))
  WITH CHECK (public.has_support_access(auth.uid(), user_id));
CREATE POLICY "Support: insert addon order"
  ON public.dashboard_addon_order FOR INSERT TO authenticated
  WITH CHECK (public.has_support_access(auth.uid(), user_id));

-- =============================================================
-- 8) Update bot-secret RPCs to honor support grants
-- =============================================================
CREATE OR REPLACE FUNCTION public.set_bot_secret(
  _bot_id UUID, _key TEXT, _value TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _slot public.bot_secret_slots%ROWTYPE;
  _last_four TEXT;
  _enc BYTEA;
  _is_support BOOLEAN := false;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.'); END IF;
  IF _key IS NULL OR length(trim(_key)) = 0 OR length(_key) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid key.');
  END IF;
  IF _value IS NULL OR length(_value) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Value cannot be empty.');
  END IF;
  IF length(_value) > 8000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Value too long.');
  END IF;

  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.'); END IF;

  IF _bot_owner <> _user_id THEN
    IF public.has_support_access(_user_id, _bot_owner) THEN
      _is_support := true;
    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'Not allowed.');
    END IF;
  END IF;

  SELECT * INTO _slot FROM public.bot_secret_slots WHERE upper(key) = upper(_key) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Unknown secret key.'); END IF;

  _last_four := CASE WHEN length(_value) >= 4 THEN right(_value, 4) ELSE repeat('*', length(_value)) END;
  _enc := extensions.pgp_sym_encrypt(_value, public._bot_secrets_key());

  INSERT INTO public.bot_secrets (bot_id, user_id, key, value_encrypted, last_four)
  VALUES (_bot_id, _bot_owner, upper(_key), _enc, _last_four)
  ON CONFLICT (bot_id, key) DO UPDATE
    SET value_encrypted = EXCLUDED.value_encrypted,
        last_four = EXCLUDED.last_four,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'key', upper(_key), 'last_four', _last_four, 'via_support', _is_support);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_bot_secret(_bot_id UUID, _key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.'); END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.'); END IF;
  IF _bot_owner <> _user_id AND NOT public.has_support_access(_user_id, _bot_owner) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed.');
  END IF;
  DELETE FROM public.bot_secrets WHERE bot_id = _bot_id AND key = upper(_key);
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_bot_secrets_metadata(_bot_id UUID)
RETURNS TABLE (
  addon_id TEXT, key TEXT, label TEXT, description TEXT, placeholder TEXT,
  is_required BOOLEAN, sort_order INTEGER, is_set BOOLEAN, last_four TEXT, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  IF _bot_owner <> _user_id AND NOT public.has_support_access(_user_id, _bot_owner) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
  SELECT s.addon_id, s.key, s.label, s.description, s.placeholder,
         s.is_required, s.sort_order, (bs.id IS NOT NULL), COALESCE(bs.last_four, ''), bs.updated_at
  FROM public.bot_secret_slots s
  LEFT JOIN public.bot_secrets bs ON bs.bot_id = _bot_id AND bs.key = s.key
  ORDER BY s.sort_order, s.label;
END;
$$;

-- Reveal: support session bypasses password requirement
CREATE OR REPLACE FUNCTION public.reveal_bot_secret(
  _bot_id UUID, _key TEXT, _password TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _stored BYTEA;
  _hashed TEXT;
  _value TEXT;
  _is_support BOOLEAN := false;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.'); END IF;

  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.'); END IF;

  IF _bot_owner = _user_id THEN
    -- Owner: must re-enter password
    IF _password IS NULL OR length(_password) = 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Password required.');
    END IF;
    SELECT encrypted_password INTO _hashed FROM auth.users WHERE id = _user_id;
    IF _hashed IS NULL OR _hashed = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Set a password on your account first.');
    END IF;
    IF extensions.crypt(_password, _hashed) <> _hashed THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Incorrect password.');
    END IF;
  ELSIF public.has_support_access(_user_id, _bot_owner) THEN
    _is_support := true;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed.');
  END IF;

  SELECT value_encrypted INTO _stored FROM public.bot_secrets WHERE bot_id = _bot_id AND key = upper(_key);
  IF _stored IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Secret not set.'); END IF;
  _value := extensions.pgp_sym_decrypt(_stored, public._bot_secrets_key());
  RETURN jsonb_build_object('ok', true, 'key', upper(_key), 'value', _value, 'via_support', _is_support);
END;
$$;