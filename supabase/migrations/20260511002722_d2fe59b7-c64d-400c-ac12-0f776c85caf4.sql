-- Backfill missing runtime status rows
INSERT INTO public.bot_runtime_status (bot_id, user_id, status)
SELECT o.id, o.user_id, 'offline'
FROM public.bot_orders o
LEFT JOIN public.bot_runtime_status s ON s.bot_id = o.id
WHERE s.bot_id IS NULL;

-- Trigger to ensure every new bot order gets a status row
CREATE OR REPLACE FUNCTION public.ensure_bot_runtime_status_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.bot_runtime_status (bot_id, user_id, status)
  VALUES (NEW.id, NEW.user_id, 'offline')
  ON CONFLICT (bot_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_bot_runtime_status_row ON public.bot_orders;
CREATE TRIGGER trg_ensure_bot_runtime_status_row
AFTER INSERT ON public.bot_orders
FOR EACH ROW
EXECUTE FUNCTION public.ensure_bot_runtime_status_row();