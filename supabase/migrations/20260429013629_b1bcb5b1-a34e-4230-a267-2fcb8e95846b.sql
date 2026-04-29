-- Codes admins generate to give people free months on a bot
CREATE TABLE public.bot_free_period_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  months INTEGER NOT NULL DEFAULT 1 CHECK (months >= 1 AND months <= 24),
  max_uses INTEGER,                             -- NULL = unlimited
  times_used INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,          -- code itself expires (not the free period)
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_free_period_codes ENABLE ROW LEVEL SECURITY;

-- Admins manage codes
CREATE POLICY "Admins can view all free period codes"
  ON public.bot_free_period_codes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert free period codes"
  ON public.bot_free_period_codes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update free period codes"
  ON public.bot_free_period_codes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete free period codes"
  ON public.bot_free_period_codes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Signed-in users can read active, non-expired codes (needed to validate at redeem time).
-- Only minimal columns are useful; RLS limits to active rows.
CREATE POLICY "Users can read active codes for redemption"
  ON public.bot_free_period_codes FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR times_used < max_uses)
  );

CREATE TRIGGER update_bot_free_period_codes_updated_at
  BEFORE UPDATE ON public.bot_free_period_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tracks when a bot has a free period active (granted via a code)
CREATE TABLE public.bot_free_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL,
  user_id UUID NOT NULL,
  free_until TIMESTAMP WITH TIME ZONE NOT NULL,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,    -- so we only email once before expiry
  resumed_at TIMESTAMP WITH TIME ZONE,          -- set when free period ends and billing resumes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (bot_id)
);

ALTER TABLE public.bot_free_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own free periods"
  ON public.bot_free_periods FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all free periods"
  ON public.bot_free_periods FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert free periods"
  ON public.bot_free_periods FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update free periods"
  ON public.bot_free_periods FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete free periods"
  ON public.bot_free_periods FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_bot_free_periods_updated_at
  BEFORE UPDATE ON public.bot_free_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log of every redemption (one row per use, even if same code redeemed many times)
CREATE TABLE public.bot_free_period_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id UUID NOT NULL REFERENCES public.bot_free_period_codes(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL,
  user_id UUID NOT NULL,
  months_granted INTEGER NOT NULL,
  previous_free_until TIMESTAMP WITH TIME ZONE,  -- if stacking, what it was before
  new_free_until TIMESTAMP WITH TIME ZONE NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_free_period_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own redemptions"
  ON public.bot_free_period_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all redemptions"
  ON public.bot_free_period_redemptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- The redeem RPC handles all the logic atomically: validates code, checks
-- ownership, stacks the free period, increments usage counter, logs redemption.
-- Runs as SECURITY DEFINER so users can update tables they don't normally touch.
CREATE OR REPLACE FUNCTION public.redeem_bot_free_period_code(
  _code TEXT,
  _bot_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _code_row public.bot_free_period_codes%ROWTYPE;
  _bot_row public.bot_orders%ROWTYPE;
  _existing public.bot_free_periods%ROWTYPE;
  _base_time TIMESTAMP WITH TIME ZONE;
  _new_until TIMESTAMP WITH TIME ZONE;
  _previous TIMESTAMP WITH TIME ZONE;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in to redeem a code.');
  END IF;

  -- Basic input validation
  IF _code IS NULL OR length(trim(_code)) = 0 OR length(_code) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please enter a valid code.');
  END IF;

  -- Find the code (case-insensitive)
  SELECT * INTO _code_row
  FROM public.bot_free_period_codes
  WHERE lower(code) = lower(trim(_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code doesn''t exist.');
  END IF;

  IF NOT _code_row.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code is no longer active.');
  END IF;

  IF _code_row.expires_at IS NOT NULL AND _code_row.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code has expired.');
  END IF;

  IF _code_row.max_uses IS NOT NULL AND _code_row.times_used >= _code_row.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code has reached its maximum number of uses.');
  END IF;

  -- Verify the bot belongs to the redeeming user
  SELECT * INTO _bot_row
  FROM public.bot_orders
  WHERE id = _bot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.');
  END IF;

  IF _bot_row.user_id <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You can only redeem codes on your own bots.');
  END IF;

  -- Stack: if there's already an active free period, extend from free_until.
  -- Otherwise start from now().
  SELECT * INTO _existing
  FROM public.bot_free_periods
  WHERE bot_id = _bot_id;

  IF FOUND AND _existing.free_until > now() THEN
    _base_time := _existing.free_until;
    _previous := _existing.free_until;
  ELSE
    _base_time := now();
    _previous := NULL;
  END IF;

  _new_until := _base_time + (_code_row.months || ' months')::interval;

  -- Upsert the free period; reset reminder/resume so the cron treats it fresh
  INSERT INTO public.bot_free_periods (bot_id, user_id, free_until)
  VALUES (_bot_id, _user_id, _new_until)
  ON CONFLICT (bot_id) DO UPDATE
    SET free_until = EXCLUDED.free_until,
        user_id = EXCLUDED.user_id,
        reminder_sent_at = NULL,
        resumed_at = NULL,
        updated_at = now();

  -- Bump usage counter on the code
  UPDATE public.bot_free_period_codes
     SET times_used = times_used + 1,
         updated_at = now()
   WHERE id = _code_row.id;

  -- Log the redemption
  INSERT INTO public.bot_free_period_redemptions
    (code_id, bot_id, user_id, months_granted, previous_free_until, new_free_until)
  VALUES
    (_code_row.id, _bot_id, _user_id, _code_row.months, _previous, _new_until);

  RETURN jsonb_build_object(
    'ok', true,
    'months_granted', _code_row.months,
    'free_until', _new_until,
    'stacked', _previous IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_bot_free_period_code(TEXT, UUID) TO authenticated;