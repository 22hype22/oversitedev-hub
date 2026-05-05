CREATE OR REPLACE FUNCTION public.set_bot_config_enabled(_bot_id uuid, _feature text, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bots WHERE id = _bot_id AND owner_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.bot_config (bot_id, feature, config, updated_at)
  VALUES (_bot_id, _feature, jsonb_build_object('enabled', _enabled), now())
  ON CONFLICT (bot_id, feature) DO UPDATE
    SET config = COALESCE(public.bot_config.config, '{}'::jsonb) || jsonb_build_object('enabled', _enabled),
        updated_at = now();
END;
$$;