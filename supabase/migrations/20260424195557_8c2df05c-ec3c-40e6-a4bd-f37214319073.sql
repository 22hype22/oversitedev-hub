-- 1. Global app settings (single-row pattern)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  marketing_suspended BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

INSERT INTO public.app_settings (id, marketing_suspended)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
CREATE POLICY "Anyone can read app settings"
  ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
CREATE POLICY "Admins can update app settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Enable realtime for live suspension updates
ALTER TABLE public.app_settings REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Recreate public_products as SECURITY DEFINER (default) so anon sees cards.
-- The view excludes sensitive file_url/file_name columns, so this is safe.
DROP VIEW IF EXISTS public.public_products;
CREATE VIEW public.public_products AS
SELECT id, name, description, price, category, emoji, image_url, image_urls,
       is_available, price_robux, gamepass_id, gamepass_url, current_version,
       upgrade_price, upgrade_price_robux, upgrade_gamepass_id, upgrade_gamepass_url,
       created_at, updated_at
FROM public.products;

GRANT SELECT ON public.public_products TO anon, authenticated;

-- 3. Auto-grant admin role when an email is added to allowlist
CREATE OR REPLACE FUNCTION public.grant_admin_on_allowlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  SELECT u.id, 'admin'::public.app_role
  FROM auth.users u
  WHERE lower(u.email) = lower(NEW.email)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_admin_allowlist_insert ON public.admin_allowlist;
CREATE TRIGGER on_admin_allowlist_insert
  AFTER INSERT ON public.admin_allowlist
  FOR EACH ROW EXECUTE FUNCTION public.grant_admin_on_allowlist();

-- 4. Revoke admin role when removed from allowlist (super admin protected via RLS already)
CREATE OR REPLACE FUNCTION public.revoke_admin_on_allowlist_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Never revoke from the super admin
  IF lower(OLD.email) = 'everant00@gmail.com' THEN
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

DROP TRIGGER IF EXISTS on_admin_allowlist_delete ON public.admin_allowlist;
CREATE TRIGGER on_admin_allowlist_delete
  AFTER DELETE ON public.admin_allowlist
  FOR EACH ROW EXECUTE FUNCTION public.revoke_admin_on_allowlist_delete();

-- 5. Make sure handle_new_user_admin trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_admin();

-- 6. Make sure new-user profile trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();