
-- 1) When a token becomes available in the pool, retry any queued orders.
CREATE OR REPLACE FUNCTION public.trigger_deploy_queued_on_token_available()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg record;
  queued record;
BEGIN
  IF NEW.status <> 'available' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'available' THEN
    RETURN NEW;
  END IF;

  SELECT fn_url, anon_key INTO cfg FROM public.deploy_config WHERE id = 1;
  IF cfg.fn_url IS NULL OR cfg.anon_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Kick the oldest queued order. The auto-deploy function will claim a token
  -- atomically; if more tokens are added, more orders get kicked.
  FOR queued IN
    SELECT id FROM public.bot_orders
    WHERE status = 'ready'
      AND deployment_status = 'queued'
      AND railway_service_id IS NULL
      AND (bot_token IS NULL OR bot_token = '')
    ORDER BY submitted_at ASC NULLS LAST, created_at ASC
    LIMIT 1
  LOOP
    PERFORM extensions.http_post(
      url := cfg.fn_url || '/auto-deploy-bot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || cfg.anon_key
      ),
      body := jsonb_build_object('orderId', queued.id, 'source', 'pool_available')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_token_pool_kick_queued ON public.bot_token_pool;
CREATE TRIGGER bot_token_pool_kick_queued
AFTER INSERT OR UPDATE OF status ON public.bot_token_pool
FOR EACH ROW
EXECUTE FUNCTION public.trigger_deploy_queued_on_token_available();


-- 2) When an order is cancelled: release its pool token and tear down Railway.
CREATE OR REPLACE FUNCTION public.trigger_release_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg record;
BEGIN
  IF NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Release any pool token assigned to this order back to "available".
  UPDATE public.bot_token_pool
  SET status = 'available',
      assigned_bot_id = NULL,
      assigned_at = NULL,
      updated_at = now()
  WHERE assigned_bot_id = NEW.id;

  -- Tear down the Railway service via the cancel-bot-deploy edge function.
  IF NEW.railway_service_id IS NOT NULL THEN
    SELECT fn_url, anon_key INTO cfg FROM public.deploy_config WHERE id = 1;
    IF cfg.fn_url IS NOT NULL AND cfg.anon_key IS NOT NULL THEN
      PERFORM extensions.http_post(
        url := cfg.fn_url || '/cancel-bot-deploy',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || cfg.anon_key
        ),
        body := jsonb_build_object('orderId', NEW.id, 'source', 'trigger')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_orders_release_on_cancel ON public.bot_orders;
CREATE TRIGGER bot_orders_release_on_cancel
AFTER UPDATE OF status ON public.bot_orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_release_on_cancel();
