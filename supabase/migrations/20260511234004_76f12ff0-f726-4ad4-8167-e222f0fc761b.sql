CREATE OR REPLACE FUNCTION public.prepare_bot_runtime_status_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.bot_id IS DISTINCT FROM OLD.bot_id THEN
    RAISE EXCEPTION 'bot_id cannot be changed';
  END IF;

  SELECT o.user_id INTO _owner
  FROM public.bot_orders o
  WHERE o.id = NEW.bot_id;

  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Bot not found';
  END IF;

  NEW.user_id := _owner;
  NEW.guilds := COALESCE(NEW.guilds, '[]'::jsonb);
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_bot_runtime_status_write() FROM public;

DROP TRIGGER IF EXISTS trg_prepare_bot_runtime_status_write ON public.bot_runtime_status;
CREATE TRIGGER trg_prepare_bot_runtime_status_write
BEFORE INSERT OR UPDATE ON public.bot_runtime_status
FOR EACH ROW
EXECUTE FUNCTION public.prepare_bot_runtime_status_write();