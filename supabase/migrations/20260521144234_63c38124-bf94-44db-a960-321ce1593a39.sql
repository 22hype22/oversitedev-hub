CREATE OR REPLACE FUNCTION public.trigger_auto_deploy_bot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  cfg record;
  _is_transition boolean;
BEGIN
  _is_transition := NEW.status = 'ready'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ready');

  IF NOT _is_transition THEN
    RETURN NEW;
  END IF;

  -- Avoid double-firing while a deploy is actively in flight.
  IF TG_OP = 'UPDATE'
     AND OLD.deployment_status = 'deploying'
     AND NEW.deployment_status = 'deploying'
  THEN
    RETURN NEW;
  END IF;

  SELECT fn_url, anon_key INTO cfg FROM public.deploy_config WHERE id = 1;
  IF cfg.fn_url IS NULL OR cfg.anon_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Re-entry from a previous cancellation (or any prior deploy state): wipe
  -- stale deployment artifacts so auto-deploy treats this like a fresh run —
  -- new token from the pool, new Railway service, new env vars.
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'ready' THEN
    NEW.railway_service_id := NULL;
    NEW.bot_token := NULL;
    NEW.deployment_error := NULL;
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

  RETURN NEW;
END;
$$;