
-- Helper: viewer has an accepted team membership on owner's account.
CREATE OR REPLACE FUNCTION public.has_team_access(_viewer_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dashboard_team t
    WHERE t.owner_user_id = _owner_id
      AND t.member_user_id = _viewer_id
      AND t.accepted_at IS NOT NULL
      AND t.role <> 'owner'
  );
$$;

-- Helper: viewer has a specific permission on owner's account based on their team role
-- (merging defaults with any custom overrides in dashboard_role_permissions).
CREATE OR REPLACE FUNCTION public.has_team_perm(_viewer_id uuid, _owner_id uuid, _perm text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role text;
  _perms jsonb;
  _custom jsonb;
BEGIN
  IF _viewer_id IS NULL OR _owner_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT role INTO _role FROM public.dashboard_team
   WHERE owner_user_id = _owner_id
     AND member_user_id = _viewer_id
     AND accepted_at IS NOT NULL
     AND role <> 'owner'
   LIMIT 1;
  IF _role IS NULL THEN RETURN false; END IF;
  _perms := public.team_default_permissions(_role);
  SELECT permissions INTO _custom FROM public.dashboard_role_permissions
   WHERE owner_user_id = _owner_id AND role = _role;
  IF _custom IS NOT NULL THEN
    _perms := _perms || _custom;
  END IF;
  RETURN COALESCE((_perms ->> _perm)::boolean, false);
END;
$$;

-- SELECT policies for team members on the same tables support has access to.
CREATE POLICY "Team: view bot orders" ON public.bot_orders FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));
CREATE POLICY "Team: update bot orders" ON public.bot_orders FOR UPDATE TO authenticated
  USING (public.has_team_perm(auth.uid(), user_id, 'edit_bot_config'))
  WITH CHECK (public.has_team_perm(auth.uid(), user_id, 'edit_bot_config'));

CREATE POLICY "Team: view bot status" ON public.bot_runtime_status FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));
CREATE POLICY "Team: view bot logs" ON public.bot_logs FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));
CREATE POLICY "Team: view bot metrics" ON public.bot_usage_metrics FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));
CREATE POLICY "Team: view bot commands" ON public.bot_commands FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));
CREATE POLICY "Team: insert bot commands" ON public.bot_commands FOR INSERT TO authenticated
  WITH CHECK (public.has_team_perm(auth.uid(), user_id, 'edit_bot_config'));

CREATE POLICY "Team: view active guilds" ON public.bot_active_guilds FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));
CREATE POLICY "Team: view channel cache" ON public.bot_channel_cache FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));
CREATE POLICY "Team: view role cache" ON public.bot_role_cache FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));
CREATE POLICY "Team: view server slots" ON public.bot_server_slots FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));

-- Secrets: only view metadata rows if the role allows manage_secrets.
CREATE POLICY "Team: view bot secret rows" ON public.bot_secrets FOR SELECT TO authenticated
  USING (public.has_team_perm(auth.uid(), user_id, 'manage_secrets'));

-- bot_config / bot_addon_state / dashboard_addon_order need a bot->owner lookup.
CREATE POLICY "Team: manage bot config" ON public.bot_config FOR ALL
  USING (
    bot_id IN (
      SELECT o.id FROM public.bot_orders o
      WHERE public.has_team_perm(auth.uid(), o.user_id, 'edit_bot_config')
    )
  )
  WITH CHECK (
    bot_id IN (
      SELECT o.id FROM public.bot_orders o
      WHERE public.has_team_perm(auth.uid(), o.user_id, 'edit_bot_config')
    )
  );

CREATE POLICY "Team: manage bot addon state" ON public.bot_addon_state FOR ALL
  USING (
    bot_id IN (
      SELECT o.id FROM public.bot_orders o
      WHERE public.has_team_perm(auth.uid(), o.user_id, 'edit_bot_config')
    )
  )
  WITH CHECK (
    bot_id IN (
      SELECT o.id FROM public.bot_orders o
      WHERE public.has_team_perm(auth.uid(), o.user_id, 'edit_bot_config')
    )
  );

CREATE POLICY "Team: view addon order" ON public.dashboard_addon_order FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));
CREATE POLICY "Team: insert addon order" ON public.dashboard_addon_order FOR INSERT TO authenticated
  WITH CHECK (public.has_team_perm(auth.uid(), user_id, 'edit_bot_config'));
CREATE POLICY "Team: update addon order" ON public.dashboard_addon_order FOR UPDATE TO authenticated
  USING (public.has_team_perm(auth.uid(), user_id, 'edit_bot_config'))
  WITH CHECK (public.has_team_perm(auth.uid(), user_id, 'edit_bot_config'));

CREATE POLICY "Team: view free periods" ON public.bot_free_periods FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));
CREATE POLICY "Team: view pending discounts" ON public.bot_pending_discounts FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));
CREATE POLICY "Team: view bot credits" ON public.bot_credits FOR SELECT TO authenticated
  USING (public.has_team_access(auth.uid(), user_id));
