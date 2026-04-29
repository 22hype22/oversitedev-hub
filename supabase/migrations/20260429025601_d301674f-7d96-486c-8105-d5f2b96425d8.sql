-- Bot logs table
CREATE TABLE public.bot_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL,
  user_id UUID NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug','info','warn','error')),
  message TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_logs_bot_created ON public.bot_logs (bot_id, created_at DESC);
CREATE INDEX idx_bot_logs_created ON public.bot_logs (created_at);

ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their bot logs"
  ON public.bot_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bot logs"
  ON public.bot_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Support: view bot logs"
  ON public.bot_logs FOR SELECT TO authenticated
  USING (public.has_support_access(auth.uid(), user_id));

CREATE POLICY "Service role manages bot logs"
  ON public.bot_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Runtime helper for service role to append a log
CREATE OR REPLACE FUNCTION public.runtime_append_bot_log(
  _bot_id UUID,
  _level TEXT,
  _message TEXT,
  _context JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bot_owner UUID;
  _id UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _level NOT IN ('debug','info','warn','error') THEN
    RAISE EXCEPTION 'Invalid level';
  END IF;
  IF _message IS NULL OR length(_message) = 0 THEN
    RAISE EXCEPTION 'Message required';
  END IF;
  IF length(_message) > 8000 THEN
    _message := left(_message, 8000);
  END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN
    RAISE EXCEPTION 'Bot not found';
  END IF;
  INSERT INTO public.bot_logs (bot_id, user_id, level, message, context)
  VALUES (_bot_id, _bot_owner, _level, _message, _context)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Cleanup function for retention
CREATE OR REPLACE FUNCTION public.cleanup_old_bot_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted INTEGER;
BEGIN
  DELETE FROM public.bot_logs WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;