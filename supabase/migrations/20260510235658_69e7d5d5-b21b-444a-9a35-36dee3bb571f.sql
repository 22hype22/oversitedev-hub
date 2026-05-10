
-- Remove all automatic notifications. Only admin-sent notifications remain.
DROP TRIGGER IF EXISTS trg_notify_command_finished ON public.bot_commands;
DROP TRIGGER IF EXISTS trg_notify_bot_offline ON public.bot_runtime_status;
DROP TRIGGER IF EXISTS trg_notify_error_spike ON public.bot_usage_metrics;

-- Clear out existing auto-generated notifications so the bell empties.
DELETE FROM public.bot_notifications
WHERE event_type IN ('command_finished','bot_offline','error_spike','free_period_expiring');
