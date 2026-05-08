-- Clear existing notifications
DELETE FROM public.bot_notifications;

-- Admin RPC to send a notification to a user (or broadcast to all users)
CREATE OR REPLACE FUNCTION public.admin_send_notification(
  _target_user_id uuid,
  _title text,
  _body text,
  _event_type text DEFAULT 'admin_message',
  _broadcast boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _title IS NULL OR length(trim(_title)) = 0 THEN
    RAISE EXCEPTION 'Title required';
  END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN
    RAISE EXCEPTION 'Body required';
  END IF;

  IF _broadcast THEN
    INSERT INTO public.bot_notifications (user_id, event_type, title, body, status)
    SELECT u.id, COALESCE(_event_type, 'admin_message'), _title, _body, 'pending'
    FROM auth.users u;
    GET DIAGNOSTICS _inserted = ROW_COUNT;
  ELSE
    IF _target_user_id IS NULL THEN
      RAISE EXCEPTION 'Target user required';
    END IF;
    INSERT INTO public.bot_notifications (user_id, event_type, title, body, status)
    VALUES (_target_user_id, COALESCE(_event_type, 'admin_message'), _title, _body, 'pending');
    _inserted := 1;
  END IF;

  RETURN _inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_send_notification(uuid, text, text, text, boolean) TO authenticated;