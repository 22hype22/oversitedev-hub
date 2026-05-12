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
  _latest_metric_members bigint;
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

  IF COALESCE(_peak_members, 0) = 0 THEN
    SELECT bum.member_count::bigint
    INTO _latest_metric_members
    FROM bot_usage_metrics bum
    WHERE bum.bot_id = _bot_id
      AND bum.member_count > 0
    ORDER BY bum.bucket_start DESC
    LIMIT 1;

    _peak_members := COALESCE(_latest_metric_members, _peak_members, 0);
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_bot_usage_daily(uuid, integer) TO authenticated, anon;