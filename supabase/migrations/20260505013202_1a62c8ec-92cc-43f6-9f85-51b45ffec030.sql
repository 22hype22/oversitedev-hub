CREATE OR REPLACE FUNCTION public.set_bot_config_enabled(_bot_id uuid, _feature text, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.bot_config (bot_id, feature, config)
  VALUES (_bot_id, _feature, jsonb_build_object('enabled', _enabled))
  ON CONFLICT (bot_id, feature)
  DO UPDATE SET
    config = COALESCE(public.bot_config.config, '{}'::jsonb) || jsonb_build_object('enabled', _enabled),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_bot_config_enabled(uuid, text, boolean) TO authenticated;