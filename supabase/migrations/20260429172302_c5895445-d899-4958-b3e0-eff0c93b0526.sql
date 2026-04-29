-- 1) Notification feed: track when a user has read a notification
ALTER TABLE public.bot_notifications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bot_notifications_user_read
  ON public.bot_notifications(user_id, read_at, created_at DESC);

-- 2) Function to enqueue free-period-expiring warnings (~3 days out)
CREATE OR REPLACE FUNCTION public.enqueue_free_period_expiring_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _row RECORD;
  _enq UUID;
  _count INTEGER := 0;
  _bot_name TEXT;
  _hours_left INTEGER;
BEGIN
  FOR _row IN
    SELECT fp.id, fp.bot_id, fp.user_id, fp.free_until
    FROM public.bot_free_periods fp
    WHERE fp.reminder_sent_at IS NULL
      AND fp.free_until > now()
      AND fp.free_until <= now() + interval '3 days'
  LOOP
    SELECT bot_name INTO _bot_name FROM public.bot_orders WHERE id = _row.bot_id;
    _hours_left := EXTRACT(EPOCH FROM (_row.free_until - now()))::int / 3600;

    SELECT public._enqueue_bot_notification(
      _row.user_id,
      _row.bot_id,
      'free_period_expiring',
      'Free period ending soon for ' || COALESCE(_bot_name, 'your bot'),
      'Heads up — the free hosting period for ' || COALESCE(_bot_name, 'your bot')
        || ' ends in about ' || (_hours_left / 24) || ' day(s) ('
        || to_char(_row.free_until AT TIME ZONE 'UTC', 'Mon DD, HH24:MI" UTC"') || ').',
      jsonb_build_object('free_until', _row.free_until)
    ) INTO _enq;

    IF _enq IS NOT NULL THEN
      UPDATE public.bot_free_periods
        SET reminder_sent_at = now()
        WHERE id = _row.id;
      _count := _count + 1;
    END IF;
  END LOOP;

  RETURN _count;
END;
$$;

-- 3) Function to detect silently-dead bots (no heartbeat for >5 min while "online")
CREATE OR REPLACE FUNCTION public.detect_stale_bots()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _row RECORD;
  _count INTEGER := 0;
BEGIN
  FOR _row IN
    SELECT id, bot_id, user_id, status, last_heartbeat_at
    FROM public.bot_runtime_status
    WHERE status IN ('online','starting','updating')
      AND last_heartbeat_at IS NOT NULL
      AND last_heartbeat_at < now() - interval '5 minutes'
  LOOP
    -- Flip to offline (this fires the existing _notify_bot_offline trigger)
    UPDATE public.bot_runtime_status
      SET status = 'offline',
          last_error = COALESCE(last_error, 'Heartbeat lost (no signal for >5 min)'),
          last_error_at = COALESCE(last_error_at, now())
      WHERE id = _row.id;
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;