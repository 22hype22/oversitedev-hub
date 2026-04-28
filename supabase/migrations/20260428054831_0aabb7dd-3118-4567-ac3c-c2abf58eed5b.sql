
-- 1. Restrict listing on public buckets (files still publicly accessible via direct CDN URL since bucket public=true)
DROP POLICY IF EXISTS "Bot assets are publicly readable" ON storage.objects;

-- product-images had no public SELECT policy (only admin); leave as-is.
-- bot-assets: replace public SELECT with owner+admin SELECT to prevent listing.
CREATE POLICY "Owners can list their bot assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bot-assets'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 2. Remove sensitive purchases table from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.purchases;

-- 3. Revoke EXECUTE on internal SECURITY DEFINER functions (triggers + email queue helpers)
REVOKE EXECUTE ON FUNCTION public.handle_new_user_admin() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prune_old_product_versions() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.link_purchases_to_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.grant_admin_on_allowlist() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.revoke_admin_on_allowlist_delete() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.queue_bot_build_on_paid() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_last_super_admin_removal() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_product_catalog() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- Email queue helpers — only the service role / edge functions need these
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;

-- Anon never needs role/membership lookups; restrict to authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_active_membership(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
