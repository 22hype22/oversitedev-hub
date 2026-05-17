
-- ===== dashboard_team =====
CREATE TABLE public.dashboard_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  member_email text NOT NULL,
  member_user_id uuid,
  role text NOT NULL CHECK (role = ANY (ARRAY['owner','co_owner','admin','moderator','viewer'])),
  invite_token text UNIQUE,
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX dashboard_team_owner_email_idx
  ON public.dashboard_team (owner_user_id, lower(member_email));

CREATE INDEX dashboard_team_member_email_idx
  ON public.dashboard_team (lower(member_email));

CREATE INDEX dashboard_team_member_user_idx
  ON public.dashboard_team (member_user_id);

ALTER TABLE public.dashboard_team ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own team"
  ON public.dashboard_team
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Members read own membership rows"
  ON public.dashboard_team
  FOR SELECT
  TO authenticated
  USING (
    member_user_id = auth.uid()
    OR lower(member_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

CREATE POLICY "Service role manages team"
  ON public.dashboard_team
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER dashboard_team_set_updated_at
  BEFORE UPDATE ON public.dashboard_team
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===== dashboard_role_permissions =====
CREATE TABLE public.dashboard_role_permissions (
  owner_user_id uuid NOT NULL,
  role text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, role)
);

ALTER TABLE public.dashboard_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own role permissions"
  ON public.dashboard_role_permissions
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Members read their owner permissions"
  ON public.dashboard_role_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboard_team t
      WHERE t.owner_user_id = dashboard_role_permissions.owner_user_id
        AND (
          t.member_user_id = auth.uid()
          OR lower(t.member_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        )
    )
  );

CREATE POLICY "Service role manages role permissions"
  ON public.dashboard_role_permissions
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER dashboard_role_permissions_set_updated_at
  BEFORE UPDATE ON public.dashboard_role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===== defaults helper =====
CREATE OR REPLACE FUNCTION public.team_default_permissions(_role text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'owner'     THEN jsonb_build_object('view_dashboard',true,'edit_bot_config',true,'manage_secrets',true,'view_logs',true,'edit_billing',true,'manage_team',true,'transfer_ownership',true)
    WHEN 'co_owner'  THEN jsonb_build_object('view_dashboard',true,'edit_bot_config',true,'manage_secrets',true,'view_logs',true,'edit_billing',true,'manage_team',true,'transfer_ownership',false)
    WHEN 'admin'     THEN jsonb_build_object('view_dashboard',true,'edit_bot_config',true,'manage_secrets',true,'view_logs',true,'edit_billing',false,'manage_team',false,'transfer_ownership',false)
    WHEN 'moderator' THEN jsonb_build_object('view_dashboard',true,'edit_bot_config',true,'manage_secrets',false,'view_logs',true,'edit_billing',false,'manage_team',false,'transfer_ownership',false)
    WHEN 'viewer'    THEN jsonb_build_object('view_dashboard',true,'edit_bot_config',false,'manage_secrets',false,'view_logs',false,'edit_billing',false,'manage_team',false,'transfer_ownership',false)
    ELSE jsonb_build_object('view_dashboard',false,'edit_bot_config',false,'manage_secrets',false,'view_logs',false,'edit_billing',false,'manage_team',false,'transfer_ownership',false)
  END;
$$;

-- ===== ensure owner row =====
CREATE OR REPLACE FUNCTION public.ensure_team_owner_row()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL THEN RETURN; END IF;

  INSERT INTO public.dashboard_team (owner_user_id, member_email, member_user_id, role, accepted_at)
  VALUES (auth.uid(), lower(_email), auth.uid(), 'owner', now())
  ON CONFLICT (owner_user_id, lower(member_email)) DO UPDATE
    SET role = 'owner',
        member_user_id = COALESCE(public.dashboard_team.member_user_id, EXCLUDED.member_user_id),
        accepted_at = COALESCE(public.dashboard_team.accepted_at, now());
END;
$$;

-- ===== accept pending invites =====
CREATE OR REPLACE FUNCTION public.team_accept_invites_for_current_user()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _count integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL THEN RETURN 0; END IF;

  UPDATE public.dashboard_team
     SET member_user_id = auth.uid(),
         accepted_at = COALESCE(accepted_at, now())
   WHERE lower(member_email) = lower(_email)
     AND (member_user_id IS NULL OR member_user_id <> auth.uid() OR accepted_at IS NULL);
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- ===== invite member =====
CREATE OR REPLACE FUNCTION public.team_invite_member(_email text, _role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token text;
  _id uuid;
  _matched_user uuid;
  _normalized text := lower(trim(_email));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF _normalized = '' OR _normalized !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid email');
  END IF;
  IF _role NOT IN ('co_owner','admin','moderator','viewer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid role');
  END IF;

  _token := encode(gen_random_bytes(18), 'hex');
  SELECT id INTO _matched_user FROM auth.users WHERE lower(email) = _normalized LIMIT 1;

  INSERT INTO public.dashboard_team (owner_user_id, member_email, member_user_id, role, invite_token, invited_by, accepted_at)
  VALUES (auth.uid(), _normalized, _matched_user, _role, _token, auth.uid(),
          CASE WHEN _matched_user IS NOT NULL THEN now() ELSE NULL END)
  ON CONFLICT (owner_user_id, lower(member_email)) DO UPDATE
    SET role = EXCLUDED.role,
        invite_token = COALESCE(public.dashboard_team.invite_token, EXCLUDED.invite_token),
        member_user_id = COALESCE(public.dashboard_team.member_user_id, EXCLUDED.member_user_id),
        invited_at = now()
  RETURNING id, invite_token INTO _id, _token;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'invite_token', _token);
END;
$$;

-- ===== remove member =====
CREATE OR REPLACE FUNCTION public.team_remove_member(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.dashboard_team;
BEGIN
  SELECT * INTO _row FROM public.dashboard_team WHERE id = _member_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not found'); END IF;
  IF _row.owner_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not owner');
  END IF;
  IF _row.role = 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot remove owner');
  END IF;
  DELETE FROM public.dashboard_team WHERE id = _member_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ===== update role =====
CREATE OR REPLACE FUNCTION public.team_update_member_role(_member_id uuid, _role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.dashboard_team;
BEGIN
  IF _role NOT IN ('co_owner','admin','moderator','viewer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid role');
  END IF;
  SELECT * INTO _row FROM public.dashboard_team WHERE id = _member_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not found'); END IF;
  IF _row.owner_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not owner');
  END IF;
  IF _row.role = 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'use transfer ownership');
  END IF;
  UPDATE public.dashboard_team SET role = _role WHERE id = _member_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ===== transfer ownership =====
CREATE OR REPLACE FUNCTION public.team_transfer_ownership(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new public.dashboard_team;
BEGIN
  SELECT * INTO _new FROM public.dashboard_team WHERE id = _member_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not found'); END IF;
  IF _new.owner_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not owner');
  END IF;
  IF _new.member_user_id IS NULL OR _new.accepted_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member has not accepted invite yet');
  END IF;
  -- demote current owner to co_owner, promote target to owner
  UPDATE public.dashboard_team SET role = 'co_owner'
   WHERE owner_user_id = auth.uid() AND role = 'owner';
  UPDATE public.dashboard_team SET role = 'owner' WHERE id = _member_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ===== effective role lookup =====
CREATE OR REPLACE FUNCTION public.team_get_effective_role(_owner_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _role text;
  _perms jsonb;
  _custom jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('role', null, 'permissions', public.team_default_permissions(''));
  END IF;
  IF auth.uid() = _owner_user_id THEN
    RETURN jsonb_build_object('role', 'owner', 'permissions', public.team_default_permissions('owner'));
  END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  SELECT role INTO _role FROM public.dashboard_team
   WHERE owner_user_id = _owner_user_id
     AND (member_user_id = auth.uid() OR lower(member_email) = lower(COALESCE(_email,'')))
   ORDER BY (accepted_at IS NOT NULL) DESC
   LIMIT 1;
  IF _role IS NULL THEN
    RETURN jsonb_build_object('role', null, 'permissions', public.team_default_permissions(''));
  END IF;
  SELECT permissions INTO _custom FROM public.dashboard_role_permissions
   WHERE owner_user_id = _owner_user_id AND role = _role;
  _perms := public.team_default_permissions(_role) || COALESCE(_custom, '{}'::jsonb);
  RETURN jsonb_build_object('role', _role, 'permissions', _perms);
END;
$$;

-- ===== upsert role permissions =====
CREATE OR REPLACE FUNCTION public.team_set_role_permissions(_role text, _permissions jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not authenticated'); END IF;
  IF _role NOT IN ('owner','co_owner','admin','moderator','viewer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid role');
  END IF;
  INSERT INTO public.dashboard_role_permissions (owner_user_id, role, permissions)
  VALUES (auth.uid(), _role, _permissions)
  ON CONFLICT (owner_user_id, role) DO UPDATE
    SET permissions = EXCLUDED.permissions, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END;
$$;
