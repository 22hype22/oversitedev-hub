
CREATE OR REPLACE FUNCTION public.auto_provision_dashboard_addon()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('ready', 'paid') THEN
    IF NEW.addons IS NULL THEN
      NEW.addons := ARRAY['dashboard']::text[];
    ELSIF NOT ('dashboard' = ANY(NEW.addons)) THEN
      NEW.addons := array_append(NEW.addons, 'dashboard');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS bot_orders_auto_provision_dashboard ON public.bot_orders;
CREATE TRIGGER bot_orders_auto_provision_dashboard
BEFORE INSERT OR UPDATE OF status, addons ON public.bot_orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_provision_dashboard_addon();

-- Backfill existing ready/paid orders missing the dashboard add-on
UPDATE public.bot_orders
SET addons = array_append(COALESCE(addons, ARRAY[]::text[]), 'dashboard')
WHERE status IN ('ready', 'paid')
  AND NOT ('dashboard' = ANY(COALESCE(addons, ARRAY[]::text[])));
