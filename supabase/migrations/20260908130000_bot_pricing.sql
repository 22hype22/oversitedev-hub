-- Per-bot pricing the owner edits from the gear on each bot card in the builder.
--
-- app_settings.bot_pricing is a map of base id -> {
--   price:         list price in USD (replaces the built-in price)
--   discount:      dollars off; the list price shows crossed out when set
--   monthly:       whether this bot bills monthly hosting
--   monthly_price: hosting price per month in USD
--   pay:           'usd', 'robux', or 'both' (how the bot can be bought)
-- }
-- Missing keys fall back to the values built into the site.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS bot_pricing jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.set_bot_pricing(_base_id text, _pricing jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not signed in');
  END IF;
  IF _email <> 'everant00@gmail.com'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
  END IF;
  IF _base_id IS NULL OR _base_id = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing base id');
  END IF;

  UPDATE public.app_settings
  SET bot_pricing = coalesce(bot_pricing, '{}'::jsonb)
                    || jsonb_build_object(_base_id, coalesce(_pricing, '{}'::jsonb)),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = 1;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_bot_pricing(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.set_bot_pricing(text, jsonb) TO authenticated;
