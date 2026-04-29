-- =============================================================
-- Bot runtime status / health telemetry
-- =============================================================
CREATE TABLE IF NOT EXISTS public.bot_runtime_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline',
  last_heartbeat_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  uptime_seconds INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  worker_id TEXT,
  version TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bot_runtime_status_status_check CHECK (
    status IN ('online','offline','starting','stopping','crashed','updating','suspended')
  )
);

CREATE INDEX IF NOT EXISTS bot_runtime_status_user_id_idx ON public.bot_runtime_status(user_id);
CREATE INDEX IF NOT EXISTS bot_runtime_status_status_idx ON public.bot_runtime_status(status);

ALTER TABLE public.bot_runtime_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their bot status"
  ON public.bot_runtime_status FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bot status"
  ON public.bot_runtime_status FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Support: view bot status"
  ON public.bot_runtime_status FOR SELECT TO authenticated
  USING (public.has_support_access(auth.uid(), user_id));

CREATE POLICY "Service role manages bot status"
  ON public.bot_runtime_status FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Auto-update timestamps
CREATE TRIGGER trg_bot_runtime_status_updated_at
  BEFORE UPDATE ON public.bot_runtime_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- Computed health view: auto-mark offline if heartbeat > 60s stale
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_bot_health(_bot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _row public.bot_runtime_status%ROWTYPE;
  _effective TEXT;
  _stale BOOLEAN := false;
  _seconds_since INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN
    RAISE EXCEPTION 'Bot not found';
  END IF;
  IF _bot_owner <> _user_id
     AND NOT public.has_role(_user_id, 'admin'::app_role)
     AND NOT public.has_support_access(_user_id, _bot_owner) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO _row FROM public.bot_runtime_status WHERE bot_id = _bot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'bot_id', _bot_id,
      'status', 'offline',
      'effective_status', 'offline',
      'never_started', true,
      'uptime_seconds', 0
    );
  END IF;

  _effective := _row.status;
  IF _row.last_heartbeat_at IS NOT NULL THEN
    _seconds_since := EXTRACT(EPOCH FROM (now() - _row.last_heartbeat_at))::int;
    IF _row.status IN ('online','starting','stopping','updating')
       AND _seconds_since > 60 THEN
      _effective := 'offline';
      _stale := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'bot_id', _bot_id,
    'status', _row.status,
    'effective_status', _effective,
    'stale', _stale,
    'last_heartbeat_at', _row.last_heartbeat_at,
    'started_at', _row.started_at,
    'uptime_seconds', _row.uptime_seconds,
    'last_error', _row.last_error,
    'last_error_at', _row.last_error_at,
    'version', _row.version,
    'updated_at', _row.updated_at
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_bot_health(UUID) TO authenticated;

-- =============================================================
-- Service-role write helper (Claude's runtime calls this)
-- =============================================================
CREATE OR REPLACE FUNCTION public.runtime_set_bot_status(
  _bot_id UUID,
  _status TEXT,
  _last_error TEXT DEFAULT NULL,
  _worker_id TEXT DEFAULT NULL,
  _version TEXT DEFAULT NULL,
  _details JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bot_owner UUID;
  _now TIMESTAMPTZ := now();
  _existing public.bot_runtime_status%ROWTYPE;
  _new_uptime INTEGER := 0;
  _started TIMESTAMPTZ;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _status NOT IN ('online','offline','starting','stopping','crashed','updating','suspended') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN
    RAISE EXCEPTION 'Bot not found';
  END IF;

  SELECT * INTO _existing FROM public.bot_runtime_status WHERE bot_id = _bot_id;

  -- Track started_at: set when transitioning into online from non-online
  IF _existing.bot_id IS NULL THEN
    _started := CASE WHEN _status = 'online' THEN _now ELSE NULL END;
    _new_uptime := 0;
  ELSE
    IF _status = 'online' AND _existing.status <> 'online' THEN
      _started := _now;
      _new_uptime := 0;
    ELSIF _status = 'online' AND _existing.started_at IS NOT NULL THEN
      _started := _existing.started_at;
      _new_uptime := EXTRACT(EPOCH FROM (_now - _existing.started_at))::int;
    ELSE
      _started := _existing.started_at;
      _new_uptime := _existing.uptime_seconds;
    END IF;
  END IF;

  INSERT INTO public.bot_runtime_status
    (bot_id, user_id, status, last_heartbeat_at, started_at, uptime_seconds,
     last_error, last_error_at, worker_id, version, details)
  VALUES
    (_bot_id, _bot_owner, _status, _now, _started, _new_uptime,
     _last_error, CASE WHEN _last_error IS NOT NULL THEN _now ELSE NULL END,
     _worker_id, _version, _details)
  ON CONFLICT (bot_id) DO UPDATE
    SET status = EXCLUDED.status,
        last_heartbeat_at = EXCLUDED.last_heartbeat_at,
        started_at = EXCLUDED.started_at,
        uptime_seconds = EXCLUDED.uptime_seconds,
        last_error = COALESCE(EXCLUDED.last_error, public.bot_runtime_status.last_error),
        last_error_at = COALESCE(EXCLUDED.last_error_at, public.bot_runtime_status.last_error_at),
        worker_id = COALESCE(EXCLUDED.worker_id, public.bot_runtime_status.worker_id),
        version = COALESCE(EXCLUDED.version, public.bot_runtime_status.version),
        details = COALESCE(EXCLUDED.details, public.bot_runtime_status.details),
        user_id = EXCLUDED.user_id;

  RETURN jsonb_build_object('ok', true, 'bot_id', _bot_id, 'status', _status);
END;
$$;