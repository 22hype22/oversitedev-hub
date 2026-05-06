CREATE OR REPLACE FUNCTION public.complete_post_message(
  _id uuid,
  _status text,
  _error text DEFAULT NULL
)
RETURNS public.bot_commands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.bot_commands;
BEGIN
  IF _status NOT IN ('done', 'failed') THEN
    RAISE EXCEPTION 'Invalid status: %, must be done or failed', _status;
  END IF;

  UPDATE public.bot_commands
  SET
    status = _status,
    error = CASE WHEN _status = 'failed' THEN _error ELSE NULL END,
    completed_at = now()
  WHERE id = _id
    AND action = 'post_message'
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_post_message(uuid, text, text) TO anon, authenticated;