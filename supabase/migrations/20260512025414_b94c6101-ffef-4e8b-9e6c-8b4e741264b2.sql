
CREATE OR REPLACE FUNCTION public.bot_runtime_status_fill_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM public.bot_orders
    WHERE id = NEW.bot_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_runtime_status_fill_user_id_trg ON public.bot_runtime_status;

CREATE TRIGGER bot_runtime_status_fill_user_id_trg
BEFORE INSERT OR UPDATE ON public.bot_runtime_status
FOR EACH ROW
EXECUTE FUNCTION public.bot_runtime_status_fill_user_id();
