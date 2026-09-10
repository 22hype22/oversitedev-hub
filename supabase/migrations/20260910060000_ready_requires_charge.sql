-- The build guard keys on charged_at alone.
--
-- paid_at is stamped by the Stripe webhook when a card is saved, before any
-- charge, so it never proved payment. charged_at is set only by a successful
-- card charge, a matched Robux sale, or a comped order.

CREATE OR REPLACE FUNCTION public.guard_ready_requires_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ready'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ready')
     AND COALESCE(NEW.total_amount, 0) > 0
     AND NEW.charged_at IS NULL THEN
    RAISE EXCEPTION 'Order % cannot start building: its payment has not been confirmed', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
