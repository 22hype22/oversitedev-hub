ALTER TABLE public.bot_channel_cache
  ADD COLUMN IF NOT EXISTS parent_position integer NOT NULL DEFAULT -1;

-- Replace the upsert RPC to accept parent_position from the worker payload.
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
  _owner uuid;
BEGIN
  IF NOT public._worker_token_lookup(_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT user_id INTO _owner FROM public.bot_orders WHERE id = _bot_id LIMIT 1;
  IF _owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bot_not_found');
  END IF;

  -- Replace cache for this bot+guild atomically.
  DELETE FROM public.bot_channel_cache
   WHERE bot_id = _bot_id AND guild_id = _guild_id;

  INSERT INTO public.bot_channel_cache
    (bot_id, user_id, guild_id, channel_id, channel_name, channel_type,
     parent_id, parent_name, position, parent_position, fetched_at)
  SELECT
    _bot_id,
    _owner,
    _guild_id,
    (c->>'channel_id'),
    (c->>'channel_name'),
    COALESCE(c->>'channel_type', 'text'),
    NULLIF(c->>'parent_id', ''),
    NULLIF(c->>'parent_name', ''),
    COALESCE((c->>'position')::int, 0),
    COALESCE((c->>'parent_position')::int, -1),
    now()
  FROM jsonb_array_elements(_channels) AS c;

  RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(_channels));
END;
$$;