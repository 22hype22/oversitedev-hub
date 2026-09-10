-- Offline notifications only for real outages.
--
-- Every hub redeploy restarts the bots, so each one dips offline for a few
-- minutes and comes back. The status trigger used to write an "offline" and a
-- "back online" notification for every bot on every change, which lit up the
-- bell with unread rows after each deploy.
--
-- Now the trigger only records when the status changed. A job that runs every
-- minute writes the "offline" notification once a bot has been offline for
-- five minutes, and the trigger writes "back online" only when an offline
-- notification was actually sent for that outage. A bot the customer stopped
-- themselves never gets an offline notification.

ALTER TABLE public.bot_runtime_status
  ADD COLUMN IF NOT EXISTS status_since timestamptz,
  ADD COLUMN IF NOT EXISTS offline_silent boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.notify_bot_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bot_name text;
  _alerted boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_since := now();

    -- Went down. A stop the customer asked for is not an outage.
    IF NEW.status IN ('offline', 'crashed') AND OLD.status NOT IN ('offline', 'crashed') THEN
      NEW.offline_silent := (OLD.status = 'stopping');
    END IF;

    -- Came back. Only worth a notification when the outage was long enough
    -- that an offline notification went out for it.
    IF NEW.status IN ('online', 'running', 'ready') AND OLD.status IN ('offline', 'crashed') THEN
      _alerted := NOT OLD.offline_silent
        AND OLD.last_offline_alert_at IS NOT NULL
        AND OLD.last_offline_alert_at >= COALESCE(OLD.status_since, now() - interval '1 day');
      IF _alerted THEN
        SELECT bot_name INTO _bot_name FROM public.bot_orders WHERE id = NEW.bot_id;
        _bot_name := COALESCE(NULLIF(trim(_bot_name), ''), 'Your bot');
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
      NEW.offline_silent := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bot_status_change ON public.bot_runtime_status;
CREATE TRIGGER trg_notify_bot_status_change
  BEFORE UPDATE ON public.bot_runtime_status
  FOR EACH ROW EXECUTE FUNCTION public.notify_bot_status_change();

-- Runs every minute. One offline notification per outage, after five minutes.
CREATE OR REPLACE FUNCTION public.alert_bots_offline_too_long()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r record;
  _count integer := 0;
BEGIN
  FOR _r IN
    SELECT s.bot_id, s.user_id, COALESCE(NULLIF(trim(o.bot_name), ''), 'Your bot') AS bot_name
    FROM public.bot_runtime_status s
    JOIN public.bot_orders o ON o.id = s.bot_id
    WHERE s.status IN ('offline', 'crashed')
      AND NOT s.offline_silent
      AND s.user_id IS NOT NULL
      AND s.status_since IS NOT NULL
      AND s.status_since < now() - interval '5 minutes'
      AND (s.last_offline_alert_at IS NULL OR s.last_offline_alert_at < s.status_since)
      AND o.status NOT IN ('cancelled', 'refunded', 'deleted')
  LOOP
    INSERT INTO public.bot_notifications (user_id, bot_id, event_type, title, body, status)
    VALUES (
      _r.user_id,
      _r.bot_id,
      'bot_down',
      'Your bot is offline',
      _r.bot_name || ' has gone offline. We''re looking into it and you''ll be notified when it''s back up.',
      'delivered'
    );
    UPDATE public.bot_runtime_status SET last_offline_alert_at = now() WHERE bot_id = _r.bot_id;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.alert_bots_offline_too_long() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'alert-bots-offline') THEN
    PERFORM cron.unschedule('alert-bots-offline');
  END IF;
  PERFORM cron.schedule('alert-bots-offline', '* * * * *', $job$SELECT public.alert_bots_offline_too_long();$job$);
END;
$$;
