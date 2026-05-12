REVOKE ALL ON FUNCTION public.prepare_bot_runtime_status_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_bot_runtime_status_write() FROM anon;
REVOKE ALL ON FUNCTION public.prepare_bot_runtime_status_write() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_bot_runtime_status_write() TO service_role;