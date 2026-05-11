GRANT EXECUTE ON FUNCTION public.runtime_set_bot_status(text, uuid, text, text, text, text, jsonb, jsonb) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.runtime_set_bot_status(uuid, text, text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.runtime_set_bot_status(uuid, text, text, text, text, jsonb) FROM public;