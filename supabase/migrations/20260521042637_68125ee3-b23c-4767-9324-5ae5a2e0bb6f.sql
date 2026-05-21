
CREATE OR REPLACE FUNCTION public.bot_runtime_status_sync_order_deployment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_heartbeat_at IS NOT NULL
     AND NEW.status IN ('online', 'starting', 'updating')
     AND (TG_OP = 'INSERT'
          OR NEW.last_heartbeat_at IS DISTINCT FROM OLD.last_heartbeat_at
          OR NEW.status IS DISTINCT FROM OLD.status)
  THEN
    UPDATE public.bot_orders
       SET deployment_status = 'deployed',
           deployment_error  = NULL,
           updated_at        = now()
     WHERE id = NEW.bot_id
       AND deployment_status IN ('failed', 'deploying', 'pending', 'queued');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_runtime_status_sync_order_deployment ON public.bot_runtime_status;
CREATE TRIGGER trg_bot_runtime_status_sync_order_deployment
AFTER INSERT OR UPDATE ON public.bot_runtime_status
FOR EACH ROW
EXECUTE FUNCTION public.bot_runtime_status_sync_order_deployment();

-- Backfill: any order whose bot has a recent heartbeat should already be 'deployed'.
UPDATE public.bot_orders o
   SET deployment_status = 'deployed',
       deployment_error  = NULL,
       updated_at        = now()
  FROM public.bot_runtime_status s
 WHERE s.bot_id = o.id
   AND s.last_heartbeat_at IS NOT NULL
   AND s.status IN ('online', 'starting', 'updating')
   AND o.deployment_status IN ('failed', 'deploying', 'pending', 'queued');
