
-- Trigger: detect status transitions on bot_runtime_status and emit notifications
CREATE OR REPLACE FUNCTION public.notify_bot_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bot_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT bot_name INTO _bot_name FROM public.bot_orders WHERE id = NEW.bot_id;
    _bot_name := COALESCE(_bot_name, 'Your bot');

    -- Went down (online -> offline/crashed)
    IF NEW.status IN ('offline', 'crashed') AND OLD.status NOT IN ('offline', 'crashed') THEN
      INSERT INTO public.bot_notifications (user_id, bot_id, event_type, title, body, status)
      VALUES (
        NEW.user_id,
        NEW.bot_id,
        'bot_down',
        'Your bot is offline',
        _bot_name || ' has gone offline. We''re looking into it — you''ll be notified when it''s back up.',
        'delivered'
      );
    END IF;

    -- Came back (offline/crashed -> online/running)
    IF NEW.status IN ('online', 'running', 'ready') AND OLD.status IN ('offline', 'crashed') THEN
      INSERT INTO public.bot_notifications (user_id, bot_id, event_type, title, body, status)
      VALUES (
        NEW.user_id,
        NEW.bot_id,
        'bot_restored',
        'Your bot is back online',
        _bot_name || ' is back online and running normally.',
        'delivered'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bot_status_change ON public.bot_runtime_status;
CREATE TRIGGER trg_notify_bot_status_change
AFTER UPDATE ON public.bot_runtime_status
FOR EACH ROW
EXECUTE FUNCTION public.notify_bot_status_change();

-- Heartbeat watchdog: mark bots offline if no heartbeat in 2 minutes
CREATE OR REPLACE FUNCTION public.mark_stale_bots_offline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bot_runtime_status
  SET status = 'offline',
      updated_at = now()
  WHERE status NOT IN ('offline', 'crashed')
    AND (last_heartbeat_at IS NULL OR last_heartbeat_at < now() - interval '2 minutes');
END;
$$;

-- Schedule it every minute
SELECT cron.unschedule('mark-stale-bots-offline') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'mark-stale-bots-offline'
);

SELECT cron.schedule(
  'mark-stale-bots-offline',
  '* * * * *',
  $$SELECT public.mark_stale_bots_offline();$$
);
