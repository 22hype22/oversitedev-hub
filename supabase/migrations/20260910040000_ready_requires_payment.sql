-- No bot starts building until its payment is confirmed.
--
-- A build begins the moment an order's status becomes 'ready' (the
-- trigger_auto_deploy_bot trigger). Every path that sets 'ready' is meant to
-- charge the card, confirm the Robux sale, or comp the order first, and each
-- of those stamps charged_at or paid_at. This guard makes that a rule of the
-- table rather than a habit of the code: an order that still owes money can
-- never turn 'ready'. Orders with nothing owed (comped, admin-linked) pass.

CREATE OR REPLACE FUNCTION public.guard_ready_requires_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ready'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ready')
     AND COALESCE(NEW.total_amount, 0) > 0
     AND NEW.charged_at IS NULL
     AND NEW.paid_at IS NULL THEN
    RAISE EXCEPTION 'Order % cannot start building: its payment has not been confirmed', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_orders_guard_ready_requires_payment ON public.bot_orders;
CREATE TRIGGER bot_orders_guard_ready_requires_payment
  BEFORE INSERT OR UPDATE ON public.bot_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_ready_requires_payment();
