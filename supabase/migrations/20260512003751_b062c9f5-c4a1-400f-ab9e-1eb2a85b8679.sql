CREATE OR REPLACE FUNCTION public.prepare_bot_runtime_status_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.bot_id IS DISTINCT FROM OLD.bot_id THEN
    RAISE EXCEPTION 'bot_id cannot be changed';
  END IF;

  SELECT o.user_id INTO _owner
  FROM public.bot_orders o
  WHERE o.id = NEW.bot_id;

  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Bot not found';
  END IF;

  NEW.user_id := _owner;

  IF TG_OP = 'UPDATE' THEN
    -- PostgREST upserts can materialize omitted jsonb columns as their table
    -- default ('[]'), which was wiping guilds during heartbeat/status-only writes.
    -- Preserve the existing guild snapshot unless a non-empty guild array is
    -- explicitly provided. Emptying the cache should happen through the runtime
    -- guild replacement RPC, not an accidental status upsert default.
    IF NEW.guilds IS NULL
       OR (
         jsonb_typeof(NEW.guilds) = 'array'
         AND jsonb_array_length(NEW.guilds) = 0
         AND OLD.guilds IS NOT NULL
         AND jsonb_typeof(OLD.guilds) = 'array'
         AND jsonb_array_length(OLD.guilds) > 0
       ) THEN
      NEW.guilds := OLD.guilds;
    END IF;
  END IF;

  NEW.guilds := COALESCE(NEW.guilds, '[]'::jsonb);
  IF jsonb_typeof(NEW.guilds) <> 'array' THEN
    RAISE EXCEPTION 'guilds must be a JSON array';
  END IF;

  NEW.updated_at := now();

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.runtime_replace_bot_guilds(_token text, _bot_id uuid, _guilds jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tok RECORD;
  _user_id uuid;
  _g jsonb;
  _ids text[] := ARRAY[]::text[];
  _status_guilds jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF _tok.bot_id IS NOT NULL AND _tok.bot_id <> _bot_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_bot_mismatch');
  END IF;

  SELECT user_id INTO _user_id FROM public.bot_orders WHERE id = _bot_id;
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bot_not_found');
  END IF;

  IF _guilds IS NULL OR jsonb_typeof(_guilds) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'guilds_must_be_array');
  END IF;

  FOR _g IN SELECT * FROM jsonb_array_elements(_guilds) LOOP
    INSERT INTO public.bot_active_guilds (bot_id, user_id, guild_id, guild_name, member_count)
    VALUES (
      _bot_id,
      _user_id,
      COALESCE(_g->>'guild_id', _g->>'id'),
      COALESCE(_g->>'guild_name', _g->>'name'),
      NULLIF(_g->>'member_count','')::int
    )
    ON CONFLICT (bot_id, guild_id) DO UPDATE SET
      guild_name = EXCLUDED.guild_name,
      member_count = EXCLUDED.member_count,
      last_seen_at = now();

    _ids := array_append(_ids, COALESCE(_g->>'guild_id', _g->>'id'));
    _status_guilds := _status_guilds || jsonb_build_array(jsonb_build_object(
      'id', COALESCE(_g->>'guild_id', _g->>'id'),
      'name', COALESCE(_g->>'guild_name', _g->>'name'),
      'member_count', NULLIF(_g->>'member_count','')::int
    ));
  END LOOP;

  DELETE FROM public.bot_active_guilds
  WHERE bot_id = _bot_id
    AND guild_id <> ALL (_ids);

  INSERT INTO public.bot_runtime_status (bot_id, user_id, status, last_heartbeat_at, guilds)
  VALUES (_bot_id, _user_id, 'online', now(), _status_guilds)
  ON CONFLICT (bot_id) DO UPDATE SET
    guilds = EXCLUDED.guilds,
    last_heartbeat_at = EXCLUDED.last_heartbeat_at,
    status = CASE
      WHEN public.bot_runtime_status.status IN ('starting','stopping','updating','suspended','crashed') THEN public.bot_runtime_status.status
      ELSE 'online'
    END,
    user_id = EXCLUDED.user_id,
    updated_at = now();

  RETURN jsonb_build_object('ok', true, 'count', COALESCE(array_length(_ids, 1), 0));
END;
$function$;