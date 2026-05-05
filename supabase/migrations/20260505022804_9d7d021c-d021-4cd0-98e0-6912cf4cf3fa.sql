
-- Auto-promote the oldest waitlisted order whenever a token becomes available.
CREATE OR REPLACE FUNCTION public.promote_waitlisted_order_on_token_available()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next_order_id UUID;
BEGIN
  -- Only act when a token transitions INTO 'available'.
  IF NEW.status <> 'available' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'available' THEN
    RETURN NEW;
  END IF;

  -- Pick the oldest waitlisted order, lock it so concurrent token releases
  -- don't promote the same order twice.
  SELECT id INTO _next_order_id
    FROM public.bot_orders
   WHERE status = 'waitlisted'
   ORDER BY COALESCE(paid_at, submitted_at, created_at) ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF _next_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Flipping to 'paid' fires the existing queue_bot_build_after_paid trigger,
  -- which enqueues the build job.
  UPDATE public.bot_orders
     SET status = 'paid',
         updated_at = now()
   WHERE id = _next_order_id
     AND status = 'waitlisted';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS promote_waitlisted_on_token_available ON public.bot_token_pool;
CREATE TRIGGER promote_waitlisted_on_token_available
  AFTER INSERT OR UPDATE OF status ON public.bot_token_pool
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_waitlisted_order_on_token_available();
