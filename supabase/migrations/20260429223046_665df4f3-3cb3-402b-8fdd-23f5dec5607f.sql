-- 1) Restrict pending_purchases INSERT to authenticated users only
DROP POLICY IF EXISTS "Valid pending purchase inserts" ON public.pending_purchases;
CREATE POLICY "Valid pending purchase inserts"
ON public.pending_purchases
FOR INSERT
TO authenticated
WITH CHECK (
  product_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.products pr
    WHERE pr.id = pending_purchases.product_id AND pr.is_available = true
  )
  AND length(COALESCE(roblox_username, '')) BETWEEN 1 AND 50
  AND length(COALESCE(gamepass_id, '')) BETWEEN 1 AND 50
  AND status = 'pending'
);

-- 2) Revoke EXECUTE from PUBLIC and anon on SECURITY DEFINER functions that
--    should never be callable without auth. Keep authenticated/service_role.
REVOKE EXECUTE ON FUNCTION public.admin_set_bot_extra_slots(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_support_access_code(integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_worker_token(text, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_bot_secret(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_bot_secret(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reveal_bot_secret(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_bot_secrets_metadata(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_bot_health(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_bot_server_limit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_bot_code(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_support_access_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_support_access_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_support_access_grant(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_worker_token(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_support_action(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_notification_rate(text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_usage_metrics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_support_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._worker_token_lookup(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.runtime_claim_next_command(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.runtime_complete_command(text, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.runtime_release_stale_commands() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.runtime_remove_bot_guild(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.runtime_set_bot_status(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.runtime_upsert_bot_guild(uuid, text, text, integer) FROM PUBLIC, anon;