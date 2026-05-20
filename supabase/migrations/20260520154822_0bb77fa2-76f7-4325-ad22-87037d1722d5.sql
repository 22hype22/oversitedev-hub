
ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS bot_token text,
  ADD COLUMN IF NOT EXISTS deployment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS deployment_error text,
  ADD COLUMN IF NOT EXISTS deployment_attempted_at timestamptz;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Internal config table for the trigger (function URL + anon key, no real secrets here)
CREATE TABLE IF NOT EXISTS public.deploy_config (
  id integer PRIMARY KEY DEFAULT 1,
  fn_url text NOT NULL,
  anon_key text NOT NULL,
  CONSTRAINT deploy_config_singleton CHECK (id = 1)
);

ALTER TABLE public.deploy_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read deploy_config" ON public.deploy_config;
CREATE POLICY "Admins read deploy_config" ON public.deploy_config
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins write deploy_config" ON public.deploy_config;
CREATE POLICY "Admins write deploy_config" ON public.deploy_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.deploy_config (id, fn_url, anon_key)
VALUES (
  1,
  'https://prvqfjairnketwhmfshu.supabase.co/functions/v1',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBydnFmamFpcm5rZXR3aG1mc2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDM2NDIsImV4cCI6MjA5MjM3OTY0Mn0.7IRfiBSkw5tM67fxYADmd8MQ619AjEb1v7exa2ZRth8'
)
ON CONFLICT (id) DO UPDATE SET fn_url = EXCLUDED.fn_url, anon_key = EXCLUDED.anon_key;

CREATE OR REPLACE FUNCTION public.trigger_auto_deploy_bot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

    PERFORM extensions.http_post(
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

DROP TRIGGER IF EXISTS bot_orders_auto_deploy ON public.bot_orders;
CREATE TRIGGER bot_orders_auto_deploy
BEFORE INSERT OR UPDATE OF status ON public.bot_orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_auto_deploy_bot();
