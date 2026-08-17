-- Helper: is the viewer platform staff?
CREATE OR REPLACE FUNCTION public.is_platform_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'support'::public.app_role)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_staff(uuid) TO authenticated, service_role;

-- Extend team perm check: platform staff pass for any bot/perm
CREATE OR REPLACE FUNCTION public.has_bot_team_perm(_viewer_id uuid, _bot_id uuid, _perm text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _role text;
  _owner uuid;
  _perms jsonb;
  _custom jsonb;
BEGIN
  IF _viewer_id IS NULL OR _bot_id IS NULL THEN
    RETURN false;
  END IF;

  -- Platform staff (admin/support) bypass: full access for support work
  IF public.is_platform_staff(_viewer_id) THEN
    RETURN true;
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
$function$;

-- Explicit policy on bot_config for platform staff (in addition to team policy)
DROP POLICY IF EXISTS "Platform staff manages bot_config" ON public.bot_config;
CREATE POLICY "Platform staff manages bot_config"
ON public.bot_config
FOR ALL
TO authenticated
USING (public.is_platform_staff(auth.uid()))
WITH CHECK (public.is_platform_staff(auth.uid()));

