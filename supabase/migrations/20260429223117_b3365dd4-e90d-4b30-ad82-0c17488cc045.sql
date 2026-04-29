REVOKE EXECUTE ON FUNCTION public._enqueue_bot_notification(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._notify_bot_offline() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._notify_command_finished() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._notify_error_spike() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.detect_stale_bots() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_free_period_expiring_alerts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_bot_notifications_read(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_bot_free_period_code(text, uuid) FROM PUBLIC, anon;