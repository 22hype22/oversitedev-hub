-- Wipe everything tied to bots, in dependency order.
DELETE FROM public.bot_dashboard_redemptions;
DELETE FROM public.bot_free_period_redemptions;
DELETE FROM public.bot_free_periods;
DELETE FROM public.bot_pending_discounts;
DELETE FROM public.bot_credits;
DELETE FROM public.bot_commands;
DELETE FROM public.bot_active_guilds;
DELETE FROM public.bot_server_slots;
DELETE FROM public.bot_usage_metrics;
DELETE FROM public.bot_runtime_status;
DELETE FROM public.bot_secrets;
DELETE FROM public.bot_logs;
DELETE FROM public.bot_build_jobs;
DELETE FROM public.dashboard_addon_order;
-- bot-scoped notifications only (keep account-level ones if any)
DELETE FROM public.bot_notifications WHERE bot_id IS NOT NULL;
-- Finally, the orders themselves
DELETE FROM public.bot_orders;