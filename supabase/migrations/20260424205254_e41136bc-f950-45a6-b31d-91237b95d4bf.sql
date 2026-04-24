-- Attach trigger to grant admin when an email is added to the allowlist
DROP TRIGGER IF EXISTS trg_grant_admin_on_allowlist ON public.admin_allowlist;
CREATE TRIGGER trg_grant_admin_on_allowlist
AFTER INSERT ON public.admin_allowlist
FOR EACH ROW
EXECUTE FUNCTION public.grant_admin_on_allowlist();

-- Attach trigger to revoke admin when an email is removed from the allowlist
DROP TRIGGER IF EXISTS trg_revoke_admin_on_allowlist_delete ON public.admin_allowlist;
CREATE TRIGGER trg_revoke_admin_on_allowlist_delete
AFTER DELETE ON public.admin_allowlist
FOR EACH ROW
EXECUTE FUNCTION public.revoke_admin_on_allowlist_delete();

-- Ensure new signups whose email is allowlisted get admin
DROP TRIGGER IF EXISTS trg_handle_new_user_admin ON auth.users;
CREATE TRIGGER trg_handle_new_user_admin
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_admin();

-- Also ensure profile auto-creation trigger is attached
DROP TRIGGER IF EXISTS trg_handle_new_user_profile ON auth.users;
CREATE TRIGGER trg_handle_new_user_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

-- Also ensure purchases get linked when a profile/user is created
DROP TRIGGER IF EXISTS trg_link_purchases_to_user ON auth.users;
CREATE TRIGGER trg_link_purchases_to_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.link_purchases_to_user();

-- Backfill: grant admin to any existing users whose email is on the allowlist
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
JOIN public.admin_allowlist a ON lower(a.email) = lower(u.email)
ON CONFLICT (user_id, role) DO NOTHING;