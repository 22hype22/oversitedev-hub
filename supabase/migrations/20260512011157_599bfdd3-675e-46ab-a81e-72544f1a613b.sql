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
  _gid text;
  _gname text;
  _mc_text text;
  _mc int;
  _existing int;
  _existing_status_count int;
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
    _gid := COALESCE(_g->>'guild_id', _g->>'id');
    _gname := COALESCE(_g->>'guild_name', _g->>'name');
    _mc_text := _g->>'member_count';
    _mc := NULLIF(_mc_text, '')::int;

    IF _gid IS NULL OR _gid = '' THEN
      CONTINUE;
    END IF;

    -- Treat NULL/0 as "unknown" and preserve the last known member count.
    IF _mc IS NULL OR _mc = 0 THEN
      SELECT member_count INTO _existing
      FROM public.bot_active_guilds
      WHERE bot_id = _bot_id AND guild_id = _gid;

      SELECT NULLIF(sg->>'member_count', '')::int INTO _existing_status_count
      FROM public.bot_runtime_status brs
      CROSS JOIN LATERAL jsonb_array_elements(brs.guilds) sg
      WHERE brs.bot_id = _bot_id
        AND sg->>'id' = _gid
        AND sg->>'member_count' IS NOT NULL
        AND sg->>'member_count' <> 'null'
      LIMIT 1;

      _mc := COALESCE(NULLIF(_existing, 0), NULLIF(_existing_status_count, 0));
    END IF;

    INSERT INTO public.bot_active_guilds (bot_id, user_id, guild_id, guild_name, member_count)
    VALUES (_bot_id, _user_id, _gid, _gname, _mc)
    ON CONFLICT (bot_id, guild_id) DO UPDATE SET
      guild_name = EXCLUDED.guild_name,
      member_count = COALESCE(NULLIF(EXCLUDED.member_count, 0), public.bot_active_guilds.member_count),
      last_seen_at = now();

    _ids := array_append(_ids, _gid);
    _status_guilds := _status_guilds || jsonb_build_array(jsonb_build_object(
      'id', _gid,
      'name', _gname,
      'member_count', _mc
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

CREATE OR REPLACE FUNCTION public.get_bot_usage_daily(_bot_id uuid, _days integer DEFAULT 7)
 RETURNS TABLE(day date, commands_count bigint, messages_count bigint, errors_count bigint, avg_active_servers numeric, max_member_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid;
  _can boolean;
  _peak_servers numeric;
  _peak_members bigint;
BEGIN
  SELECT user_id INTO _owner FROM bot_orders WHERE id = _bot_id;
  IF _owner IS NULL THEN
    RETURN;
  END IF;
  _can :=
    auth.uid() = _owner
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_support_access(auth.uid(), _owner);
  IF NOT _can THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(jsonb_array_length(brs.guilds), 0)::numeric,
    COALESCE((
      SELECT SUM(COALESCE(NULLIF(g->>'member_count', '')::bigint, 0))
      FROM jsonb_array_elements(brs.guilds) g
      WHERE g->>'member_count' IS NOT NULL
        AND g->>'member_count' <> 'null'
    ), 0)::bigint
  INTO _peak_servers, _peak_members
  FROM bot_runtime_status brs
  WHERE brs.bot_id = _bot_id;

  _peak_servers := COALESCE(_peak_servers, 0);
  _peak_members := COALESCE(_peak_members, 0);

  RETURN QUERY
  WITH days AS (
    SELECT (date_trunc('day', now()) - (n || ' days')::interval)::date AS d
    FROM generate_series(0, GREATEST(_days - 1, 0)) AS n
  ),
  cmds AS (
    SELECT
      date_trunc('day', created_at)::date AS d,
      COUNT(*) FILTER (WHERE action = 'apply_config' AND status = 'done')   AS commands_count,
      COUNT(*) FILTER (WHERE action = 'post_message' AND status = 'done')   AS messages_count,
      COUNT(*) FILTER (WHERE status = 'failed')                              AS errors_count
    FROM bot_commands
    WHERE bot_id = _bot_id
      AND created_at >= now() - (_days || ' days')::interval
    GROUP BY 1
  )
  SELECT
    d.d AS day,
    COALESCE(c.commands_count, 0)::bigint,
    COALESCE(c.messages_count, 0)::bigint,
    COALESCE(c.errors_count, 0)::bigint,
    _peak_servers,
    _peak_members
  FROM days d
  LEFT JOIN cmds c ON c.d = d.d
  ORDER BY d.d ASC;
END;
$function$;