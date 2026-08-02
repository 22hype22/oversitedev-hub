-- auto-deploy-bot bakes the customer's ER:LC key into the Dispatch service's
-- env vars at deploy time (belt-and-suspenders so the bot works at boot even
-- if the runtime token read ever hiccups). It reads the key through the same
-- runtime_get_bot_secret RPC the bot uses, but from a service-role client.
--
-- runtime_get_bot_secret REVOKEs EXECUTE from PUBLIC and only GRANTs it to
-- anon + authenticated, so service_role currently can't call it. Grant it here.
-- Safe: the function still requires a valid, bot-scoped worker token as an
-- argument, and service_role is server-side only.
GRANT EXECUTE ON FUNCTION public.runtime_get_bot_secret(text, uuid, text) TO service_role;
