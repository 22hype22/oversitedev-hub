-- 1. Credit balance per bot (for $-off codes redeemed in dashboard)
CREATE TABLE public.bot_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bot credits"
  ON public.bot_credits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bot credits"
  ON public.bot_credits FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage bot credits"
  ON public.bot_credits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Pending percent-off discounts queued for next month's hosting
CREATE TABLE public.bot_pending_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL,
  user_id UUID NOT NULL,
  discount_code_id UUID,
  percent_off NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT 'discount_code',
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_pending_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pending discounts"
  ON public.bot_pending_discounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all pending discounts"
  ON public.bot_pending_discounts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage pending discounts"
  ON public.bot_pending_discounts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Audit log for any code redeemed in the dashboard
CREATE TABLE public.bot_dashboard_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bot_id UUID NOT NULL,
  code TEXT NOT NULL,
  code_type TEXT NOT NULL, -- 'free_period' | 'discount_amount' | 'discount_percent'
  free_period_code_id UUID,
  discount_code_id UUID,
  months_granted INTEGER,
  credit_added_cents INTEGER,
  percent_off NUMERIC,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_dashboard_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own redemptions audit"
  ON public.bot_dashboard_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all redemption audits"
  ON public.bot_dashboard_redemptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Unified redeem RPC: handles free-period codes AND discount codes
CREATE OR REPLACE FUNCTION public.redeem_bot_code(_code TEXT, _bot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_row public.bot_orders%ROWTYPE;
  _trimmed TEXT;
  _free public.bot_free_period_codes%ROWTYPE;
  _disc public.discount_codes%ROWTYPE;
  _existing public.bot_free_periods%ROWTYPE;
  _base_time TIMESTAMPTZ;
  _new_until TIMESTAMPTZ;
  _previous TIMESTAMPTZ;
  _credit_cents INTEGER;
  _new_balance INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in to redeem a code.');
  END IF;

  IF _code IS NULL OR length(trim(_code)) = 0 OR length(_code) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please enter a valid code.');
  END IF;
  _trimmed := trim(_code);

  -- Verify bot ownership
  SELECT * INTO _bot_row FROM public.bot_orders WHERE id = _bot_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.');
  END IF;
  IF _bot_row.user_id <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You can only redeem codes on your own bots.');
  END IF;

  -- Try free-period code first
  SELECT * INTO _free FROM public.bot_free_period_codes
   WHERE lower(code) = lower(_trimmed) LIMIT 1;

  IF FOUND THEN
    IF NOT _free.is_active THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That code is no longer active.');
    END IF;
    IF _free.expires_at IS NOT NULL AND _free.expires_at <= now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That code has expired.');
    END IF;
    IF _free.max_uses IS NOT NULL AND _free.times_used >= _free.max_uses THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That code has reached its maximum number of uses.');
    END IF;

    SELECT * INTO _existing FROM public.bot_free_periods WHERE bot_id = _bot_id;
    IF FOUND AND _existing.free_until > now() THEN
      _base_time := _existing.free_until;
      _previous := _existing.free_until;
    ELSE
      _base_time := now();
      _previous := NULL;
    END IF;
    _new_until := _base_time + (_free.months || ' months')::interval;

    INSERT INTO public.bot_free_periods (bot_id, user_id, free_until)
    VALUES (_bot_id, _user_id, _new_until)
    ON CONFLICT (bot_id) DO UPDATE
      SET free_until = EXCLUDED.free_until,
          user_id = EXCLUDED.user_id,
          reminder_sent_at = NULL,
          resumed_at = NULL,
          updated_at = now();

    UPDATE public.bot_free_period_codes
       SET times_used = times_used + 1, updated_at = now()
     WHERE id = _free.id;

    INSERT INTO public.bot_free_period_redemptions
      (code_id, bot_id, user_id, months_granted, previous_free_until, new_free_until)
    VALUES (_free.id, _bot_id, _user_id, _free.months, _previous, _new_until);

    INSERT INTO public.bot_dashboard_redemptions
      (user_id, bot_id, code, code_type, free_period_code_id, months_granted)
    VALUES (_user_id, _bot_id, _trimmed, 'free_period', _free.id, _free.months);

    RETURN jsonb_build_object(
      'ok', true,
      'type', 'free_period',
      'months_granted', _free.months,
      'free_until', _new_until,
      'stacked', _previous IS NOT NULL
    );
  END IF;

  -- Try discount code
  SELECT * INTO _disc FROM public.discount_codes
   WHERE lower(code) = lower(_trimmed) LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code doesn''t exist.');
  END IF;

  IF NOT _disc.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code is no longer active.');
  END IF;
  IF _disc.expires_at IS NOT NULL AND _disc.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code has expired.');
  END IF;
  IF _disc.max_uses IS NOT NULL AND _disc.times_used >= _disc.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That code has reached its maximum number of uses.');
  END IF;

  IF _disc.kind = 'amount' THEN
    -- $ off → add to bot credit balance (rolls over month to month)
    _credit_cents := round(_disc.value * 100)::int;

    INSERT INTO public.bot_credits (bot_id, user_id, balance_cents)
    VALUES (_bot_id, _user_id, _credit_cents)
    ON CONFLICT (bot_id) DO UPDATE
      SET balance_cents = public.bot_credits.balance_cents + EXCLUDED.balance_cents,
          user_id = EXCLUDED.user_id,
          updated_at = now()
    RETURNING balance_cents INTO _new_balance;

    UPDATE public.discount_codes
       SET times_used = times_used + 1, updated_at = now()
     WHERE id = _disc.id;

    INSERT INTO public.bot_dashboard_redemptions
      (user_id, bot_id, code, code_type, discount_code_id, credit_added_cents)
    VALUES (_user_id, _bot_id, _trimmed, 'discount_amount', _disc.id, _credit_cents);

    RETURN jsonb_build_object(
      'ok', true,
      'type', 'discount_amount',
      'credit_added_cents', _credit_cents,
      'new_balance_cents', _new_balance
    );
  ELSIF _disc.kind = 'percent' THEN
    -- % off → queue for next month's hosting charge
    INSERT INTO public.bot_pending_discounts
      (bot_id, user_id, discount_code_id, percent_off)
    VALUES (_bot_id, _user_id, _disc.id, _disc.value);

    UPDATE public.discount_codes
       SET times_used = times_used + 1, updated_at = now()
     WHERE id = _disc.id;

    INSERT INTO public.bot_dashboard_redemptions
      (user_id, bot_id, code, code_type, discount_code_id, percent_off)
    VALUES (_user_id, _bot_id, _trimmed, 'discount_percent', _disc.id, _disc.value);

    RETURN jsonb_build_object(
      'ok', true,
      'type', 'discount_percent',
      'percent_off', _disc.value
    );
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'Unsupported code type.');
END;
$$;

-- updated_at trigger for bot_credits
CREATE TRIGGER update_bot_credits_updated_at
  BEFORE UPDATE ON public.bot_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();