-- Restrict execution of new functions to the appropriate roles
REVOKE EXECUTE ON FUNCTION public.runtime_record_bot_metrics(uuid, integer, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_record_bot_metrics(uuid, integer, integer, integer, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_bot_usage_daily(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bot_usage_daily(uuid, integer) TO authenticated;