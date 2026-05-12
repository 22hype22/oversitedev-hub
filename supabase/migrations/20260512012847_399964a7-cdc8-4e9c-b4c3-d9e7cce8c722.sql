
DROP FUNCTION IF EXISTS public.get_bot_usage_daily(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_bot_usage_daily(_bot_id uuid, _days int DEFAULT 14)
RETURNS TABLE (
  day date,
  messages bigint,
  commands bigint,
  errors bigint,
  peak_servers int,
  peak_members int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _peak_servers int;
  _peak_members int;
BEGIN
  SELECT
    COALESCE(jsonb_array_length(brs.guilds), 0),
    COALESCE((
      SELECT SUM(COALESCE(NULLIF((g->>'member_count'),'')::int, 0))::int
      FROM jsonb_array_elements(brs.guilds) g
    ), 0)
  INTO _peak_servers, _peak_members
  FROM public.bot_runtime_status brs
  WHERE brs.bot_id = _bot_id;

  RETURN QUERY
  SELECT
    d::date AS day,
    COALESCE(SUM(bum.messages_count), 0)::bigint,
    COALESCE(SUM(bum.commands_count), 0)::bigint,
    COALESCE(SUM(bum.errors_count), 0)::bigint,
    COALESCE(_peak_servers, 0),
    COALESCE(_peak_members, 0)
  FROM generate_series(
    (CURRENT_DATE - (_days - 1) * INTERVAL '1 day')::date,
    CURRENT_DATE,
    INTERVAL '1 day'
  ) d
  LEFT JOIN public.bot_usage_metrics bum
    ON bum.bot_id = _bot_id AND bum.bucket_start::date = d::date
  GROUP BY d
  ORDER BY d;
END;
$$;
