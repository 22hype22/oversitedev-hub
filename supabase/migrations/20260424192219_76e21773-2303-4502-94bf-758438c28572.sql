
-- Helper: check if current user is the super admin (everant00@gmail.com)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND lower(email) = 'everant00@gmail.com'
  );
$$;

-- Allow super admin to manage admin_allowlist
DROP POLICY IF EXISTS "Super admin can insert allowlist" ON public.admin_allowlist;
CREATE POLICY "Super admin can insert allowlist"
  ON public.admin_allowlist FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admin can delete allowlist" ON public.admin_allowlist;
CREATE POLICY "Super admin can delete allowlist"
  ON public.admin_allowlist FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Allow super admin to grant the admin role to existing users immediately
DROP POLICY IF EXISTS "Super admin can grant roles" ON public.user_roles;
CREATE POLICY "Super admin can grant roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admin can revoke roles" ON public.user_roles;
CREATE POLICY "Super admin can revoke roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));
