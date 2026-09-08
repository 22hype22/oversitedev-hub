-- Security hardening, part 1: scope what the public key can touch.
--
-- Found in an authorized review of the live project with only the anon key:
--   * every bot_commands row (all bots, all payloads) was readable, and rows
--     could be marked claimed/completed;
--   * every bot_config row (all bots' settings, economy balances, blacklists,
--     package files) was readable, writable, and insertable;
--   * bot_runtime_status, bot_addon_state, platform_settings extras, and the
--     id/name of every bot_orders row were readable;
--   * set_bot_availability could be called without signing in and flipped any
--     bot to coming soon;
--   * increment_discount_code_usage could be called without signing in.
--
-- The bots authenticate every request with their own worker token in the
-- x-worker-token header. PostgREST exposes request headers to SQL, so the
-- anon policies below resolve that header to a bot id and allow exactly that
-- bot's rows. A request without a valid worker token sees nothing.

-- Which bot is making this request, from the x-worker-token header.
CREATE OR REPLACE FUNCTION public.worker_bot_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _hdr text;
  _tok text;
  _bot uuid;
BEGIN
  BEGIN
    _hdr := current_setting('request.headers', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF _hdr IS NULL OR _hdr = '' THEN
    RETURN NULL;
  END IF;
  _tok := (_hdr::json ->> 'x-worker-token');
  IF _tok IS NULL OR length(_tok) < 16 THEN
    RETURN NULL;
  END IF;
  SELECT l.bot_id INTO _bot FROM public._worker_token_lookup(_tok) l LIMIT 1;
  RETURN _bot;
END;
$$;
REVOKE ALL ON FUNCTION public.worker_bot_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_bot_id() TO anon, authenticated, service_role;

-- Drop every anon policy on the bot-facing tables, whatever it was named
-- (several were created outside these migrations), then recreate scoped ones.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('bot_commands', 'bot_config', 'bot_runtime_status', 'bot_addon_state', 'platform_settings', 'bot_orders')
      AND 'anon' = ANY (roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- bot_commands: a bot sees and updates only its own queue.
CREATE POLICY "Worker reads own bot commands"
  ON public.bot_commands FOR SELECT TO anon
  USING (bot_id = public.worker_bot_id());
CREATE POLICY "Worker updates own bot commands"
  ON public.bot_commands FOR UPDATE TO anon
  USING (bot_id = public.worker_bot_id())
  WITH CHECK (bot_id = public.worker_bot_id());

-- bot_config: a bot reads, writes, and creates only its own rows.
CREATE POLICY "Worker reads own bot config"
  ON public.bot_config FOR SELECT TO anon
  USING (bot_id = public.worker_bot_id());
CREATE POLICY "Worker updates own bot config"
  ON public.bot_config FOR UPDATE TO anon
  USING (bot_id = public.worker_bot_id())
  WITH CHECK (bot_id = public.worker_bot_id());
CREATE POLICY "Worker inserts own bot config"
  ON public.bot_config FOR INSERT TO anon
  WITH CHECK (bot_id = public.worker_bot_id());

-- bot_runtime_status: a bot writes only its own heartbeat.
CREATE POLICY "Worker reads own runtime status"
  ON public.bot_runtime_status FOR SELECT TO anon
  USING (bot_id = public.worker_bot_id());
CREATE POLICY "Worker inserts own runtime status"
  ON public.bot_runtime_status FOR INSERT TO anon
  WITH CHECK (bot_id = public.worker_bot_id());
CREATE POLICY "Worker updates own runtime status"
  ON public.bot_runtime_status FOR UPDATE TO anon
  USING (bot_id = public.worker_bot_id())
  WITH CHECK (bot_id = public.worker_bot_id());

-- bot_addon_state: a bot reads only its own addon flags.
CREATE POLICY "Worker reads own addon state"
  ON public.bot_addon_state FOR SELECT TO anon
  USING (bot_id = public.worker_bot_id());

-- platform_settings: the extras keys, and only for a real bot.
CREATE POLICY "Worker reads extras settings"
  ON public.platform_settings FOR SELECT TO anon
  USING (key LIKE 'extras-%' AND public.worker_bot_id() IS NOT NULL);

-- bot_orders: a bot reads its own id/name/bio only (column grants unchanged).
CREATE POLICY "Worker reads own order name"
  ON public.bot_orders FOR SELECT TO anon
  USING (id = public.worker_bot_id());

-- set_bot_availability: owner or admin only. It was callable by anyone.
CREATE OR REPLACE FUNCTION public.set_bot_availability(_base_id text, _status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not signed in');
  END IF;
  IF _email <> 'everant00@gmail.com'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
  END IF;
  IF _base_id IS NULL OR _base_id !~ '^[a-z0-9-]{1,40}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bad base id');
  END IF;
  IF _status NOT IN ('available', 'preorder', 'coming_soon') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bad status');
  END IF;
  UPDATE public.app_settings
  SET bot_availability = coalesce(bot_availability, '{}'::jsonb) || jsonb_build_object(_base_id, _status),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = 1;
  RETURN jsonb_build_object('ok', true, 'base', _base_id, 'status', _status);
END;
$$;
REVOKE ALL ON FUNCTION public.set_bot_availability(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_bot_availability(text, text) TO authenticated;

-- Remove the junk key the review wrote while proving the hole.
UPDATE public.app_settings
SET bot_availability = bot_availability - 'x'
WHERE id = 1 AND bot_availability ? 'x';

-- Discount usage counter: signed-in callers only.
REVOKE ALL ON FUNCTION public.increment_discount_code_usage(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_discount_code_usage(text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
