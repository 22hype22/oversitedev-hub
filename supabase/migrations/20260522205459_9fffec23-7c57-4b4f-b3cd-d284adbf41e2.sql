CREATE OR REPLACE FUNCTION public.get_bot_token_label(_bot_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bot_username
  FROM public.bot_token_pool
  WHERE assigned_bot_id = _bot_id
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_bot_token_label(uuid) TO authenticated;