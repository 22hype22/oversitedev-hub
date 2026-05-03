CREATE OR REPLACE FUNCTION public.runtime_upsert_bot_channels(
  _token text,
  _bot_id uuid,
  _guild_id text,
  _channels jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tok record;
  _owner uuid;
  _inserted integer := 0;
BEGIN
  SELECT * INTO _tok
  FROM public._worker_token_lookup(_token)
  LIMIT 1;

  IF _tok.token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_bot_mismatch');
  END IF;

  SELECT user_id INTO _owner
  FROM public.bot_orders
  WHERE id = _bot_id
  LIMIT 1;

  IF _owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bot_not_found');
  END IF;

  DELETE FROM public.bot_channel_cache
  WHERE bot_id = _bot_id
    AND guild_id = _guild_id;

  IF _channels IS NOT NULL AND jsonb_typeof(_channels) = 'array' THEN
    INSERT INTO public.bot_channel_cache (
      bot_id,
      user_id,
      guild_id,
      channel_id,
      channel_name,
      channel_type,
      parent_id,
      parent_name,
      position,
      parent_position,
      fetched_at
    )
    SELECT
      _bot_id,
      _owner,
      _guild_id,
      c->>'channel_id',
      COALESCE(NULLIF(c->>'channel_name', ''), c->>'channel_id'),
      COALESCE(NULLIF(c->>'channel_type', ''), 'text'),
      NULLIF(c->>'parent_id', ''),
      NULLIF(c->>'parent_name', ''),
      COALESCE(NULLIF(c->>'position', '')::integer, 0),
      COALESCE(NULLIF(c->>'parent_position', '')::integer, -1),
      now()
    FROM jsonb_array_elements(_channels) AS c;

    GET DIAGNOSTICS _inserted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('ok', true, 'count', _inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.runtime_upsert_bot_channels(text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.runtime_upsert_bot_channels(text, uuid, text, jsonb) TO service_role;