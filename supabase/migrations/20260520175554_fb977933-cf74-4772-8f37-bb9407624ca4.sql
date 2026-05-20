
-- =========================================================
-- 1. Add bot_id to dashboard_team, backfill, enforce NOT NULL
-- =========================================================
ALTER TABLE public.dashboard_team ADD COLUMN IF NOT EXISTS bot_id uuid;

-- Backfill: for each existing membership row (owner-scoped), insert one
-- per-bot row covering every bot the owner currently has. Then delete the
-- original owner-scoped row. Existing teammates keep access to current bots;
-- only NEW bots will be empty until invited.
DO $$
DECLARE
  r record;
  b record;
  _new_token text;
BEGIN
  FOR r IN SELECT * FROM public.dashboard_team WHERE bot_id IS NULL LOOP
    FOR b IN SELECT id FROM public.bot_orders WHERE user_id = r.owner_user_id LOOP
      _new_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      INSERT INTO public.dashboard_team (
        owner_user_id, member_email, member_user_id, role,
        invite_token, invited_by, invited_at, accepted_at,
        bot_id
      ) VALUES (
        r.owner_user_id, r.member_email, r.member_user_id, r.role,
        _new_token, r.invited_by, r.invited_at, r.accepted_at,
        b.id
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
    DELETE FROM public.dashboard_team WHERE id = r.id;
  END LOOP;
END $$;

-- Any remaining bot_id NULL rows (owner had no bots) -> just delete them;
-- they grant no access and can't be matched.
DELETE FROM public.dashboard_team WHERE bot_id IS NULL;

ALTER TABLE public.dashboard_team ALTER COLUMN bot_id SET NOT NULL;

-- Swap unique constraint: per-bot uniqueness instead of per-owner.
DROP INDEX IF EXISTS public.dashboard_team_owner_email_idx;
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_team_bot_email_idx
  ON public.dashboard_team (bot_id, lower(member_email));
CREATE INDEX IF NOT EXISTS dashboard_team_bot_member_idx
  ON public.dashboard_team (bot_id, member_user_id);

-- =========================================================
-- 2. Bot-scoped security-definer helpers
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_bot_team_access(_viewer_id uuid, _bot_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dashboard_team t
    WHERE t.bot_id = _bot_id
      AND t.member_user_id = _viewer_id
      AND t.accepted_at IS NOT NULL
      AND t.role <> 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_bot_team_perm(_viewer_id uuid, _bot_id uuid, _perm text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
  _owner uuid;
  _perms jsonb;
  _custom jsonb;
BEGIN
  IF _viewer_id IS NULL OR _bot_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT role, owner_user_id INTO _role, _owner FROM public.dashboard_team
   WHERE bot_id = _bot_id
     AND member_user_id = _viewer_id
     AND accepted_at IS NOT NULL
     AND role <> 'owner'
   LIMIT 1;
  IF _role IS NULL THEN RETURN false; END IF;
  _perms := public.team_default_permissions(_role);
  SELECT permissions INTO _custom FROM public.dashboard_role_permissions
   WHERE owner_user_id = _owner AND role = _role;
  IF _custom IS NOT NULL THEN
    _perms := _perms || _custom;
  END IF;
  RETURN COALESCE((_perms ->> _perm)::boolean, false);
END;
$$;

-- =========================================================
-- 3. Rewrite legacy owner-scoped helpers to fail closed
--    (so any leftover policy referencing them denies by default)
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_team_access(_viewer_id uuid, _owner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT false; $$;

CREATE OR REPLACE FUNCTION public.has_team_perm(_viewer_id uuid, _owner_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT false; $$;

-- =========================================================
-- 4. Replace per-table "Team:" RLS policies with bot-aware ones
-- =========================================================

-- bot_active_guilds
DROP POLICY IF EXISTS "Team: view active guilds" ON public.bot_active_guilds;
CREATE POLICY "Team: view active guilds" ON public.bot_active_guilds
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));

-- bot_addon_state
DROP POLICY IF EXISTS "Team: manage bot addon state" ON public.bot_addon_state;
CREATE POLICY "Team: manage bot addon state" ON public.bot_addon_state
  FOR ALL
  USING (has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'))
  WITH CHECK (has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'));

-- bot_channel_cache
DROP POLICY IF EXISTS "Team: view channel cache" ON public.bot_channel_cache;
CREATE POLICY "Team: view channel cache" ON public.bot_channel_cache
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));

-- bot_commands
DROP POLICY IF EXISTS "Team: view bot commands" ON public.bot_commands;
DROP POLICY IF EXISTS "Team: insert bot commands" ON public.bot_commands;
CREATE POLICY "Team: view bot commands" ON public.bot_commands
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));
CREATE POLICY "Team: insert bot commands" ON public.bot_commands
  FOR INSERT TO authenticated
  WITH CHECK (has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'));

-- bot_config
DROP POLICY IF EXISTS "Team: manage bot config" ON public.bot_config;
CREATE POLICY "Team: manage bot config" ON public.bot_config
  FOR ALL
  USING (has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'))
  WITH CHECK (has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'));

-- bot_credits
DROP POLICY IF EXISTS "Team: view bot credits" ON public.bot_credits;
CREATE POLICY "Team: view bot credits" ON public.bot_credits
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));

-- bot_free_periods
DROP POLICY IF EXISTS "Team: view free periods" ON public.bot_free_periods;
CREATE POLICY "Team: view free periods" ON public.bot_free_periods
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));

-- bot_logs
DROP POLICY IF EXISTS "Team: view bot logs" ON public.bot_logs;
CREATE POLICY "Team: view bot logs" ON public.bot_logs
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));

-- bot_orders (bot_id = id)
DROP POLICY IF EXISTS "Team: view bot orders" ON public.bot_orders;
DROP POLICY IF EXISTS "Team: update bot orders" ON public.bot_orders;
CREATE POLICY "Team: view bot orders" ON public.bot_orders
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), id));
CREATE POLICY "Team: update bot orders" ON public.bot_orders
  FOR UPDATE TO authenticated
  USING (has_bot_team_perm(auth.uid(), id, 'edit_bot_config'))
  WITH CHECK (has_bot_team_perm(auth.uid(), id, 'edit_bot_config'));

-- bot_pending_discounts
DROP POLICY IF EXISTS "Team: view pending discounts" ON public.bot_pending_discounts;
CREATE POLICY "Team: view pending discounts" ON public.bot_pending_discounts
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));

-- bot_role_cache
DROP POLICY IF EXISTS "Team: view role cache" ON public.bot_role_cache;
CREATE POLICY "Team: view role cache" ON public.bot_role_cache
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));

-- bot_runtime_status
DROP POLICY IF EXISTS "Team: view bot status" ON public.bot_runtime_status;
CREATE POLICY "Team: view bot status" ON public.bot_runtime_status
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));

-- bot_secrets
DROP POLICY IF EXISTS "Team: view bot secret rows" ON public.bot_secrets;
CREATE POLICY "Team: view bot secret rows" ON public.bot_secrets
  FOR SELECT TO authenticated
  USING (has_bot_team_perm(auth.uid(), bot_id, 'manage_secrets'));

-- bot_usage_metrics
DROP POLICY IF EXISTS "Team: view bot metrics" ON public.bot_usage_metrics;
CREATE POLICY "Team: view bot metrics" ON public.bot_usage_metrics
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));

-- dashboard_addon_order
DROP POLICY IF EXISTS "Team: view addon order" ON public.dashboard_addon_order;
DROP POLICY IF EXISTS "Team: insert addon order" ON public.dashboard_addon_order;
DROP POLICY IF EXISTS "Team: update addon order" ON public.dashboard_addon_order;
CREATE POLICY "Team: view addon order" ON public.dashboard_addon_order
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));
CREATE POLICY "Team: insert addon order" ON public.dashboard_addon_order
  FOR INSERT TO authenticated
  WITH CHECK (has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'));
CREATE POLICY "Team: update addon order" ON public.dashboard_addon_order
  FOR UPDATE TO authenticated
  USING (has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'))
  WITH CHECK (has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'));

-- bot_server_slots is owner-level (billing). Remove team access entirely;
-- team members shouldn't see slot subscriptions.
DROP POLICY IF EXISTS "Team: view server slots" ON public.bot_server_slots;

-- dashboard_team: members read their own row(s); team-roster read for any
-- bot the viewer is themselves a member of.
DROP POLICY IF EXISTS "Team members can read team roster" ON public.dashboard_team;
CREATE POLICY "Team members can read team roster" ON public.dashboard_team
  FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));

-- =========================================================
-- 5. RPCs: team_invite_member now requires a bot_id; team_get_effective_role
--    resolves per-bot. Old signatures are dropped so stale callers fail loud.
-- =========================================================
DROP FUNCTION IF EXISTS public.team_invite_member(text, text);
CREATE OR REPLACE FUNCTION public.team_invite_member(_email text, _role text, _bot_id uuid)
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
  _owner uuid;
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
  IF _bot_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bot_id required');
  END IF;

  SELECT user_id INTO _owner FROM public.bot_orders WHERE id = _bot_id;
  IF _owner IS NULL OR _owner <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not your bot');
  END IF;

  _token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  SELECT id INTO _matched_user FROM auth.users WHERE lower(email) = _normalized LIMIT 1;

  INSERT INTO public.dashboard_team (
    owner_user_id, member_email, member_user_id, role,
    invite_token, invited_by, accepted_at, bot_id
  ) VALUES (
    auth.uid(), _normalized, _matched_user, _role,
    _token, auth.uid(),
    CASE WHEN _matched_user IS NOT NULL THEN now() ELSE NULL END,
    _bot_id
  )
  ON CONFLICT (bot_id, lower(member_email)) DO UPDATE
    SET role = EXCLUDED.role,
        invite_token = COALESCE(public.dashboard_team.invite_token, EXCLUDED.invite_token),
        member_user_id = COALESCE(public.dashboard_team.member_user_id, EXCLUDED.member_user_id),
        invited_at = now()
  RETURNING id, invite_token INTO _id, _token;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'invite_token', _token);
END;
$$;

DROP FUNCTION IF EXISTS public.team_get_effective_role(uuid);
CREATE OR REPLACE FUNCTION public.team_get_effective_role(_bot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _role text;
  _perms jsonb;
  _custom jsonb;
  _owner uuid;
BEGIN
  IF auth.uid() IS NULL OR _bot_id IS NULL THEN
    RETURN jsonb_build_object('role', null, 'permissions', public.team_default_permissions(''));
  END IF;
  SELECT user_id INTO _owner FROM public.bot_orders WHERE id = _bot_id;
  IF _owner IS NULL THEN
    RETURN jsonb_build_object('role', null, 'permissions', public.team_default_permissions(''));
  END IF;
  IF auth.uid() = _owner THEN
    RETURN jsonb_build_object('role', 'owner', 'permissions', public.team_default_permissions('owner'));
  END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  SELECT role INTO _role FROM public.dashboard_team
   WHERE bot_id = _bot_id
     AND (member_user_id = auth.uid() OR lower(member_email) = lower(COALESCE(_email,'')))
   ORDER BY (accepted_at IS NOT NULL) DESC
   LIMIT 1;
  IF _role IS NULL THEN
    RETURN jsonb_build_object('role', null, 'permissions', public.team_default_permissions(''));
  END IF;
  SELECT permissions INTO _custom FROM public.dashboard_role_permissions
   WHERE owner_user_id = _owner AND role = _role;
  _perms := public.team_default_permissions(_role) || COALESCE(_custom, '{}'::jsonb);
  RETURN jsonb_build_object('role', _role, 'permissions', _perms);
END;
$$;

-- =========================================================
-- 6. dashboard_role_permissions: members read perms if they're on ANY bot
--    of that owner (matrix stays owner-wide).
-- =========================================================
DROP POLICY IF EXISTS "Members read their owner permissions" ON public.dashboard_role_permissions;
CREATE POLICY "Members read their owner permissions" ON public.dashboard_role_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dashboard_team t
    WHERE t.owner_user_id = dashboard_role_permissions.owner_user_id
      AND t.member_user_id = auth.uid()
      AND t.accepted_at IS NOT NULL
  ));
