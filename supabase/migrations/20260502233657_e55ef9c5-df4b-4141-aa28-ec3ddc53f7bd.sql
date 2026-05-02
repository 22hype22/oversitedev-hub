CREATE OR REPLACE FUNCTION public.runtime_upsert_bot_roles(
  _token text,
  _bot_id uuid,
  _guild_id text,
  _roles jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tok record;
  _user_id uuid;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_bot_mismatch');
  END IF;

  SELECT user_id INTO _user_id FROM public.bot_orders WHERE id = _bot_id LIMIT 1;
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bot_not_found');
  END IF;

  DELETE FROM public.bot_role_cache
  WHERE bot_id = _bot_id AND guild_id = _guild_id;

  IF _roles IS NOT NULL AND jsonb_typeof(_roles) = 'array' THEN
    INSERT INTO public.bot_role_cache (
      bot_id, user_id, guild_id, role_id, role_name,
      color, position, managed, is_everyone, fetched_at
    )
    SELECT
      _bot_id,
      _user_id,
      _guild_id,
      r->>'role_id',
      r->>'role_name',
      COALESCE((r->>'color')::integer, 0),
      COALESCE((r->>'position')::integer, 0),
      COALESCE((r->>'managed')::boolean, false),
      COALESCE((r->>'is_everyone')::boolean, false),
      now()
    FROM jsonb_array_elements(_roles) AS r
    WHERE COALESCE(r->>'role_id', '') <> ''
      AND COALESCE(r->>'role_name', '') <> '';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'count', COALESCE(jsonb_array_length(_roles), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.runtime_upsert_bot_roles(text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.runtime_upsert_bot_roles(text, uuid, text, jsonb) TO service_role;