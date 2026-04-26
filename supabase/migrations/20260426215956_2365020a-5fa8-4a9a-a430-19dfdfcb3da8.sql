-- 1. Add is_super column to admin_allowlist
ALTER TABLE public.admin_allowlist
  ADD COLUMN IF NOT EXISTS is_super boolean NOT NULL DEFAULT false;

-- 2. Ensure there is at least one super admin (migrate the previously hardcoded email)
INSERT INTO public.admin_allowlist (email, is_super)
VALUES ('everant00@gmail.com', true)
ON CONFLICT (email) DO UPDATE SET is_super = true;

-- 3. Enforce at least one super admin must always exist (prevents accidental lockout)
CREATE OR REPLACE FUNCTION public.prevent_last_super_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- On DELETE of a super admin, ensure another super remains
  IF TG_OP = 'DELETE' AND OLD.is_super = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE is_super = true AND id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'Cannot remove the last super admin';
    END IF;
  END IF;

  -- On UPDATE that demotes a super admin, ensure another super remains
  IF TG_OP = 'UPDATE' AND OLD.is_super = true AND NEW.is_super = false THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_allowlist
      WHERE is_super = true AND id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'Cannot demote the last super admin';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_last_super_admin ON public.admin_allowlist;
CREATE TRIGGER protect_last_super_admin
  BEFORE UPDATE OR DELETE ON public.admin_allowlist
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_super_admin_removal();

-- 4. Replace is_super_admin to use the allowlist instead of hardcoded email
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.admin_allowlist a ON lower(a.email) = lower(u.email)
    WHERE u.id = _user_id
      AND a.is_super = true
  );
$$;

-- 5. Update revoke trigger to also protect super admins by flag (not by hardcoded email)
CREATE OR REPLACE FUNCTION public.revoke_admin_on_allowlist_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Never revoke admin role from a super admin (defensive — delete is already blocked above)
  IF OLD.is_super = true THEN
    RETURN OLD;
  END IF;
  DELETE FROM public.user_roles ur
  USING auth.users u
  WHERE ur.user_id = u.id
    AND ur.role = 'admin'::public.app_role
    AND lower(u.email) = lower(OLD.email);
  RETURN OLD;
END;
$$;