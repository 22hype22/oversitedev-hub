CREATE OR REPLACE FUNCTION public.trigger_release_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- NOTE: We intentionally do NOT release the bot_token_pool slot here.
  -- cancel-bot-deploy needs the token still assigned so it can resolve and
  -- reset the Discord identity (avatar/bio) before releasing the token back
  -- to the pool. The edge function handles the release itself.

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

  RETURN NEW;
END;
$$;