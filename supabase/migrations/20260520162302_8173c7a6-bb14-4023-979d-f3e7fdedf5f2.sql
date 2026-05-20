
CREATE OR REPLACE FUNCTION public.trigger_auto_deploy_bot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  cfg record;
BEGIN
  IF NEW.status = 'ready'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ready')
     AND COALESCE(NEW.deployment_status, 'pending') <> 'deployed'
     AND NEW.railway_service_id IS NULL
  THEN
    SELECT fn_url, anon_key INTO cfg FROM public.deploy_config WHERE id = 1;
    IF cfg.fn_url IS NULL OR cfg.anon_key IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := cfg.fn_url || '/auto-deploy-bot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || cfg.anon_key
      ),
      body := jsonb_build_object('orderId', NEW.id, 'source', 'trigger')
    );

    NEW.deployment_status := 'deploying';
    NEW.deployment_attempted_at := now();
    NEW.deployment_error := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_deploy_queued_on_token_available()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
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

  FOR queued IN
    SELECT id FROM public.bot_orders
    WHERE status = 'ready'
      AND deployment_status = 'queued'
      AND railway_service_id IS NULL
      AND (bot_token IS NULL OR bot_token = '')
    ORDER BY submitted_at ASC NULLS LAST, created_at ASC
    LIMIT 1
  LOOP
    PERFORM net.http_post(
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

CREATE OR REPLACE FUNCTION public.trigger_release_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
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

  UPDATE public.bot_token_pool
  SET status = 'available',
      assigned_bot_id = NULL,
      assigned_at = NULL,
      updated_at = now()
  WHERE assigned_bot_id = NEW.id;

  IF NEW.railway_service_id IS NOT NULL THEN
    SELECT fn_url, anon_key INTO cfg FROM public.deploy_config WHERE id = 1;
    IF cfg.fn_url IS NOT NULL AND cfg.anon_key IS NOT NULL THEN
      PERFORM net.http_post(
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
