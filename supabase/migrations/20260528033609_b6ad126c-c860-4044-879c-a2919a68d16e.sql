
-- verification_attempts
CREATE TABLE public.verification_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id uuid NOT NULL,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, guild_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.verification_attempts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_attempts TO authenticated;
GRANT ALL ON public.verification_attempts TO service_role;

ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon bots can read verification_attempts"
  ON public.verification_attempts FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.bot_orders WHERE bot_orders.id = verification_attempts.bot_id));

CREATE POLICY "Anon bots can insert verification_attempts"
  ON public.verification_attempts FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.bot_orders WHERE bot_orders.id = verification_attempts.bot_id));

CREATE POLICY "Anon bots can update verification_attempts"
  ON public.verification_attempts FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.bot_orders WHERE bot_orders.id = verification_attempts.bot_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bot_orders WHERE bot_orders.id = verification_attempts.bot_id));

CREATE POLICY "Service role manages verification_attempts"
  ON public.verification_attempts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Team can view verification_attempts"
  ON public.verification_attempts FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));

CREATE INDEX idx_verification_attempts_bot_guild ON public.verification_attempts(bot_id, guild_id);

-- verification_queue
CREATE TABLE public.verification_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id uuid NOT NULL,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  username text,
  account_age_days integer,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.verification_queue TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_queue TO authenticated;
GRANT ALL ON public.verification_queue TO service_role;

ALTER TABLE public.verification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon bots can read verification_queue"
  ON public.verification_queue FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.bot_orders WHERE bot_orders.id = verification_queue.bot_id));

CREATE POLICY "Anon bots can insert verification_queue"
  ON public.verification_queue FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.bot_orders WHERE bot_orders.id = verification_queue.bot_id));

CREATE POLICY "Anon bots can update verification_queue"
  ON public.verification_queue FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.bot_orders WHERE bot_orders.id = verification_queue.bot_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bot_orders WHERE bot_orders.id = verification_queue.bot_id));

CREATE POLICY "Service role manages verification_queue"
  ON public.verification_queue FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Team can view verification_queue"
  ON public.verification_queue FOR SELECT TO authenticated
  USING (has_bot_team_access(auth.uid(), bot_id));

CREATE INDEX idx_verification_queue_bot_status ON public.verification_queue(bot_id, status);
