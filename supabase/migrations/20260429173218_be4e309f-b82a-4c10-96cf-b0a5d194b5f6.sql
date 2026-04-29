-- =========================================================
-- 1. WORKER TOKENS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.worker_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  bot_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  notes TEXT
);

ALTER TABLE public.worker_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view worker tokens"
  ON public.worker_tokens FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert worker tokens"
  ON public.worker_tokens FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update worker tokens"
  ON public.worker_tokens FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete worker tokens"
  ON public.worker_tokens FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a worker token (admin only). Returns the plaintext ONCE.
CREATE OR REPLACE FUNCTION public.create_worker_token(_name TEXT, _bot_id UUID DEFAULT NULL, _notes TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _admin UUID := auth.uid();
  _plain TEXT;
  _hash TEXT;
  _prefix TEXT;
  _id UUID;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only admins can create worker tokens.');
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 OR length(_name) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Provide a valid name.');
  END IF;

  _plain := 'wkr_' || encode(extensions.gen_random_bytes(24), 'hex');
  _hash := encode(extensions.digest(_plain, 'sha256'), 'hex');
  _prefix := left(_plain, 12);

  INSERT INTO public.worker_tokens (name, token_hash, token_prefix, bot_id, created_by, notes)
  VALUES (trim(_name), _hash, _prefix, _bot_id, _admin, _notes)
  RETURNING id INTO _id;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'token', _plain, 'prefix', _prefix);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_worker_token(_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed.');
  END IF;
  UPDATE public.worker_tokens SET revoked_at = COALESCE(revoked_at, now()) WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Internal: validate token, return token row id + bot scope. service_role only.
CREATE OR REPLACE FUNCTION public._worker_token_lookup(_token TEXT)
RETURNS TABLE(token_id UUID, bot_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash TEXT;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN;
  END IF;
  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');
  RETURN QUERY
  SELECT wt.id, wt.bot_id
  FROM public.worker_tokens wt
  WHERE wt.token_hash = _hash AND wt.revoked_at IS NULL;
END;
$$;

-- Worker claims one pending command for an allowed bot
CREATE OR REPLACE FUNCTION public.runtime_claim_next_command(_token TEXT, _worker_id TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tok RECORD;
  _cmd public.bot_commands%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  -- Atomic claim
  WITH next AS (
    SELECT id FROM public.bot_commands
    WHERE status = 'pending'
      AND (_tok.bot_id IS NULL OR bot_id = _tok.bot_id)
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.bot_commands c
    SET status = 'claimed',
        claimed_at = now(),
        worker_id = COALESCE(_worker_id, c.worker_id),
        updated_at = now()
    FROM next
    WHERE c.id = next.id
    RETURNING c.* INTO _cmd;

  UPDATE public.worker_tokens SET last_used_at = now() WHERE id = _tok.token_id;

  IF _cmd.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'command', NULL);
  END IF;
  RETURN jsonb_build_object('ok', true, 'command', to_jsonb(_cmd));
END;
$$;

CREATE OR REPLACE FUNCTION public.runtime_complete_command(_token TEXT, _command_id UUID, _status TEXT, _error TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tok RECORD;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _status NOT IN ('done','failed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  UPDATE public.bot_commands
    SET status = _status,
        error_message = _error,
        completed_at = now(),
        updated_at = now()
  WHERE id = _command_id
    AND (_tok.bot_id IS NULL OR bot_id = _tok.bot_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- =========================================================
-- 2. STALE CLEANUP HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.runtime_release_stale_commands()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count INTEGER;
BEGIN
  UPDATE public.bot_commands
    SET status = 'pending',
        claimed_at = NULL,
        worker_id = NULL,
        updated_at = now()
  WHERE status = 'claimed'
    AND claimed_at IS NOT NULL
    AND claimed_at < now() - interval '2 minutes';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_usage_metrics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count INTEGER;
BEGIN
  DELETE FROM public.bot_usage_metrics WHERE bucket_start < now() - interval '90 days';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count INTEGER;
BEGIN
  DELETE FROM public.bot_notifications
   WHERE created_at < now() - interval '60 days'
     AND read_at IS NOT NULL;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- =========================================================
-- 3. ADMIN AUDIT LOG
-- =========================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  target_user_id UUID,
  target_bot_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON public.admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_log(target_user_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages audit log"
  ON public.admin_audit_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action TEXT,
  _target_user_id UUID DEFAULT NULL,
  _target_bot_id UUID DEFAULT NULL,
  _details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _id UUID;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin'::app_role) THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.admin_audit_log (admin_user_id, target_user_id, target_bot_id, action, details)
  VALUES (_admin, _target_user_id, _target_bot_id, _action, _details)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- =========================================================
-- 4. NOTIFICATION RATE LIMIT
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notification_rate_limits (
  user_id UUID NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kind, bucket_start)
);

ALTER TABLE public.notification_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages rate limits"
  ON public.notification_rate_limits FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users see their own rate limits"
  ON public.notification_rate_limits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_notification_rate(_kind TEXT, _max INTEGER DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user UUID := auth.uid();
  _bucket TIMESTAMPTZ := date_trunc('hour', now());
  _current INTEGER;
BEGIN
  IF _user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  INSERT INTO public.notification_rate_limits (user_id, kind, bucket_start, count)
  VALUES (_user, _kind, _bucket, 1)
  ON CONFLICT (user_id, kind, bucket_start)
  DO UPDATE SET count = public.notification_rate_limits.count + 1
  RETURNING count INTO _current;

  IF _current > _max THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rate limit exceeded. Try again later.', 'retry_after_seconds', 3600);
  END IF;
  RETURN jsonb_build_object('ok', true, 'remaining', _max - _current);
END;
$$;

-- =========================================================
-- 5. REALTIME for bot_logs (for live viewer)
-- =========================================================
ALTER TABLE public.bot_logs REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;