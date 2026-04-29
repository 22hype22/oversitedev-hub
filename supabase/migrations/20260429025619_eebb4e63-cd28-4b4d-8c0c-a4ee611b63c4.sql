REVOKE ALL ON FUNCTION public.runtime_append_bot_log(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_bot_logs() FROM PUBLIC, anon, authenticated;