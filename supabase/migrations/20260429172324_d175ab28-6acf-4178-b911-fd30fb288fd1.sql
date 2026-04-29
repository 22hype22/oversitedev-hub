CREATE OR REPLACE FUNCTION public.mark_bot_notifications_read(_ids uuid[] DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _count INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    UPDATE public.bot_notifications
      SET read_at = now()
      WHERE user_id = _user_id AND read_at IS NULL;
  ELSE
    UPDATE public.bot_notifications
      SET read_at = now()
      WHERE user_id = _user_id AND read_at IS NULL AND id = ANY(_ids);
  END IF;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;