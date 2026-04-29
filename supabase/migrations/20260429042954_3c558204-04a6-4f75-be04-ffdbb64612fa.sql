-- Hourly usage metrics buckets per bot
CREATE TABLE public.bot_usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL,
  user_id UUID NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL, -- truncated to the hour
  commands_count INTEGER NOT NULL DEFAULT 0,
  messages_count INTEGER NOT NULL DEFAULT 0,
  active_servers INTEGER NOT NULL DEFAULT 0, -- last reported in bucket
  member_count INTEGER NOT NULL DEFAULT 0,   -- last reported in bucket
  errors_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bot_id, bucket_start)
);

CREATE INDEX idx_bot_usage_metrics_bot_bucket
  ON public.bot_usage_metrics (bot_id, bucket_start DESC);

ALTER TABLE public.bot_usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their bot metrics"
  ON public.bot_usage_metrics FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bot metrics"
  ON public.bot_usage_metrics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Support: view bot metrics"
  ON public.bot_usage_metrics FOR SELECT TO authenticated
  USING (public.has_support_access(auth.uid(), user_id));

CREATE POLICY "Service role manages bot metrics"
  ON public.bot_usage_metrics FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_bot_usage_metrics_updated_at
  BEFORE UPDATE ON public.bot_usage_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Runtime RPC: increment counters and set gauges atomically for the current hour
CREATE OR REPLACE FUNCTION public.runtime_record_bot_metrics(
  _bot_id UUID,
  _commands_delta INTEGER DEFAULT 0,
  _messages_delta INTEGER DEFAULT 0,
  _errors_delta INTEGER DEFAULT 0,
  _active_servers INTEGER DEFAULT NULL,
  _member_count INTEGER DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _bot_owner UUID;
  _bucket TIMESTAMPTZ := date_trunc('hour', now());
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN
    RAISE EXCEPTION 'Bot not found';
  END IF;

  INSERT INTO public.bot_usage_metrics
    (bot_id, user_id, bucket_start, commands_count, messages_count, errors_count,
     active_servers, member_count)
  VALUES
    (_bot_id, _bot_owner, _bucket,
     GREATEST(_commands_delta, 0),
     GREATEST(_messages_delta, 0),
     GREATEST(_errors_delta, 0),
     COALESCE(_active_servers, 0),
     COALESCE(_member_count, 0))
  ON CONFLICT (bot_id, bucket_start) DO UPDATE
    SET commands_count = public.bot_usage_metrics.commands_count + GREATEST(_commands_delta, 0),
        messages_count = public.bot_usage_metrics.messages_count + GREATEST(_messages_delta, 0),
        errors_count   = public.bot_usage_metrics.errors_count   + GREATEST(_errors_delta, 0),
        active_servers = COALESCE(_active_servers, public.bot_usage_metrics.active_servers),
        member_count   = COALESCE(_member_count,   public.bot_usage_metrics.member_count),
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'bucket_start', _bucket);
END;
$$;

-- Read RPC: returns daily-aggregated metrics for the last 7 days for a bot
CREATE OR REPLACE FUNCTION public.get_bot_usage_daily(_bot_id UUID, _days INTEGER DEFAULT 7)
RETURNS TABLE (
  day DATE,
  commands_count BIGINT,
  messages_count BIGINT,
  errors_count BIGINT,
  avg_active_servers NUMERIC,
  max_member_count BIGINT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _range INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  IF _bot_owner <> _user_id
     AND NOT public.has_role(_user_id, 'admin'::app_role)
     AND NOT public.has_support_access(_user_id, _bot_owner) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  _range := GREATEST(LEAST(COALESCE(_days, 7), 30), 1);

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      (current_date - (_range - 1))::date,
      current_date,
      interval '1 day'
    )::date AS day
  )
  SELECT d.day,
         COALESCE(SUM(m.commands_count), 0)::bigint,
         COALESCE(SUM(m.messages_count), 0)::bigint,
         COALESCE(SUM(m.errors_count), 0)::bigint,
         COALESCE(AVG(NULLIF(m.active_servers, 0)), 0)::numeric,
         COALESCE(MAX(m.member_count), 0)::bigint
  FROM days d
  LEFT JOIN public.bot_usage_metrics m
    ON m.bot_id = _bot_id
   AND date_trunc('day', m.bucket_start)::date = d.day
  GROUP BY d.day
  ORDER BY d.day ASC;
END;
$$;