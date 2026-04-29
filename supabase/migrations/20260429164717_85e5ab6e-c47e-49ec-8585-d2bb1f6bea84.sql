-- ============================================================
-- 1. user_notification_prefs (global per account)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_notification_prefs (
  user_id UUID PRIMARY KEY,
  notify_bot_offline BOOLEAN NOT NULL DEFAULT true,
  notify_error_spike BOOLEAN NOT NULL DEFAULT true,
  notify_command_finished BOOLEAN NOT NULL DEFAULT true,
  notify_free_period_expiring BOOLEAN NOT NULL DEFAULT true,
  error_spike_threshold INTEGER NOT NULL DEFAULT 10,
  discord_user_id TEXT,
  discord_username TEXT,
  discord_linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notif prefs"
  ON public.user_notification_prefs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own notif prefs"
  ON public.user_notification_prefs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own notif prefs"
  ON public.user_notification_prefs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all notif prefs"
  ON public.user_notification_prefs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages notif prefs"
  ON public.user_notification_prefs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_user_notification_prefs_updated_at
  BEFORE UPDATE ON public.user_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. bot_notifications outbox
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  bot_id UUID,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  context JSONB,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | skipped
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_notifications_user ON public.bot_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_notifications_pending ON public.bot_notifications (status, created_at) WHERE status = 'pending';

ALTER TABLE public.bot_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.bot_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all notifications"
  ON public.bot_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages notifications"
  ON public.bot_notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_bot_notifications_updated_at
  BEFORE UPDATE ON public.bot_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Debounce columns
-- ============================================================
ALTER TABLE public.bot_runtime_status
  ADD COLUMN IF NOT EXISTS last_offline_alert_at TIMESTAMPTZ;

ALTER TABLE public.bot_usage_metrics
  ADD COLUMN IF NOT EXISTS last_error_alert_at TIMESTAMPTZ;

-- ============================================================
-- 4. Helper: enqueue a notification respecting prefs
-- ============================================================
CREATE OR REPLACE FUNCTION public._enqueue_bot_notification(
  _user_id UUID,
  _bot_id UUID,
  _event_type TEXT,
  _title TEXT,
  _body TEXT,
  _context JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _prefs public.user_notification_prefs%ROWTYPE;
  _enabled BOOLEAN;
  _id UUID;
BEGIN
  SELECT * INTO _prefs FROM public.user_notification_prefs WHERE user_id = _user_id;

  -- If no prefs row, treat all as enabled (default true)
  IF NOT FOUND THEN
    _enabled := true;
  ELSE
    _enabled := CASE _event_type
      WHEN 'bot_offline' THEN _prefs.notify_bot_offline
      WHEN 'error_spike' THEN _prefs.notify_error_spike
      WHEN 'command_finished' THEN _prefs.notify_command_finished
      WHEN 'free_period_expiring' THEN _prefs.notify_free_period_expiring
      ELSE true
    END;
  END IF;

  IF NOT _enabled THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.bot_notifications (user_id, bot_id, event_type, title, body, context)
  VALUES (_user_id, _bot_id, _event_type, _title, _body, _context)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- ============================================================
-- 5. Triggers
-- ============================================================

-- 5a: bot offline / crashed
CREATE OR REPLACE FUNCTION public._notify_bot_offline()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _bot_name TEXT;
BEGIN
  IF NEW.status IN ('offline','crashed')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND OLD.status IN ('online','starting','updating') THEN

    -- Debounce: skip if alerted in last hour
    IF NEW.last_offline_alert_at IS NOT NULL
       AND NEW.last_offline_alert_at > now() - interval '1 hour' THEN
      RETURN NEW;
    END IF;

    SELECT bot_name INTO _bot_name FROM public.bot_orders WHERE id = NEW.bot_id;

    PERFORM public._enqueue_bot_notification(
      NEW.user_id,
      NEW.bot_id,
      'bot_offline',
      COALESCE(_bot_name, 'Your bot') || ' went offline',
      CASE WHEN NEW.status = 'crashed'
           THEN COALESCE(_bot_name, 'Your bot') || ' crashed' ||
                CASE WHEN NEW.last_error IS NOT NULL THEN ': ' || NEW.last_error ELSE '.' END
           ELSE COALESCE(_bot_name, 'Your bot') || ' is now offline.'
      END,
      jsonb_build_object('status', NEW.status, 'last_error', NEW.last_error)
    );

    NEW.last_offline_alert_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bot_offline ON public.bot_runtime_status;
CREATE TRIGGER trg_notify_bot_offline
  BEFORE UPDATE ON public.bot_runtime_status
  FOR EACH ROW EXECUTE FUNCTION public._notify_bot_offline();

-- 5b: error spike on metrics upsert
CREATE OR REPLACE FUNCTION public._notify_error_spike()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _threshold INTEGER := 10;
  _bot_name TEXT;
  _user_threshold INTEGER;
BEGIN
  -- Fetch user-specific threshold if set
  SELECT error_spike_threshold INTO _user_threshold
  FROM public.user_notification_prefs WHERE user_id = NEW.user_id;
  IF _user_threshold IS NOT NULL THEN
    _threshold := GREATEST(_user_threshold, 1);
  END IF;

  IF NEW.errors_count >= _threshold THEN
    -- Debounce: only one alert per bucket
    IF NEW.last_error_alert_at IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT bot_name INTO _bot_name FROM public.bot_orders WHERE id = NEW.bot_id;

    PERFORM public._enqueue_bot_notification(
      NEW.user_id,
      NEW.bot_id,
      'error_spike',
      'Error spike on ' || COALESCE(_bot_name, 'your bot'),
      COALESCE(_bot_name, 'Your bot') || ' has logged ' || NEW.errors_count
        || ' errors this hour. Check the dashboard for details.',
      jsonb_build_object('errors_count', NEW.errors_count, 'bucket_start', NEW.bucket_start)
    );

    NEW.last_error_alert_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_error_spike ON public.bot_usage_metrics;
CREATE TRIGGER trg_notify_error_spike
  BEFORE INSERT OR UPDATE ON public.bot_usage_metrics
  FOR EACH ROW EXECUTE FUNCTION public._notify_error_spike();

-- 5c: command finished
CREATE OR REPLACE FUNCTION public._notify_command_finished()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _bot_name TEXT;
BEGIN
  IF NEW.status IN ('done','failed')
     AND OLD.status NOT IN ('done','failed') THEN

    SELECT bot_name INTO _bot_name FROM public.bot_orders WHERE id = NEW.bot_id;

    PERFORM public._enqueue_bot_notification(
      NEW.user_id,
      NEW.bot_id,
      'command_finished',
      'Command "' || NEW.action || '" ' ||
        CASE WHEN NEW.status = 'done' THEN 'completed' ELSE 'failed' END
        || ' on ' || COALESCE(_bot_name, 'your bot'),
      CASE WHEN NEW.status = 'done'
           THEN 'Your ' || NEW.action || ' command on ' || COALESCE(_bot_name, 'your bot') || ' finished successfully.'
           ELSE 'Your ' || NEW.action || ' command on ' || COALESCE(_bot_name, 'your bot') || ' failed' ||
                CASE WHEN NEW.error_message IS NOT NULL THEN ': ' || NEW.error_message ELSE '.' END
      END,
      jsonb_build_object('action', NEW.action, 'status', NEW.status, 'error', NEW.error_message)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_command_finished ON public.bot_commands;
CREATE TRIGGER trg_notify_command_finished
  AFTER UPDATE ON public.bot_commands
  FOR EACH ROW EXECUTE FUNCTION public._notify_command_finished();