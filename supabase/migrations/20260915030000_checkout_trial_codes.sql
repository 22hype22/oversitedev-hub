-- Trials belong at checkout, not on a bot you already own.
--
-- The trial shipped as a dashboard redemption: you had to own the bot first,
-- then apply the code to make its hosting free. That is backwards for a trial —
-- the whole point is to hand the bot to someone who has not bought it. Entering
-- the code at checkout got "Invalid or expired code", because the checkout box
-- only ever looked at discount_codes.
--
-- validate_checkout_code is what that box calls now: it answers for both kinds
-- of code, and says which kind it found so the checkout can price it.
-- Free-month codes are deliberately NOT accepted here; they extend an existing
-- bot's hosting and still belong on the dashboard.

create or replace function public.validate_checkout_code(_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
DECLARE
  _trimmed TEXT;
  _d public.discount_codes%ROWTYPE;
  _t public.bot_free_period_codes%ROWTYPE;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 OR length(_code) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter a code.');
  END IF;
  _trimmed := trim(_code);

  -- Money off.
  SELECT * INTO _d FROM public.discount_codes
   WHERE lower(code) = lower(_trimmed)
     AND is_active
     AND (expires_at IS NULL OR expires_at > now())
     AND (max_uses IS NULL OR times_used < max_uses)
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'kind', _d.kind, 'code', _d.code, 'value', _d.value);
  END IF;

  -- A trial. Only codes that actually are trials, and only while the date they
  -- run to is still ahead — a trial that ends next Tuesday is worth nothing on
  -- Wednesday, however many uses it has left.
  SELECT * INTO _t FROM public.bot_free_period_codes
   WHERE lower(code) = lower(_trimmed)
   LIMIT 1;
  IF FOUND THEN
    IF NOT coalesce(_t.teardown_on_expiry, false) OR _t.ends_at IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'That code is for a bot you already own. Redeem it from your dashboard.'
      );
    END IF;
    IF NOT _t.is_active THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That code is no longer active.');
    END IF;
    IF _t.expires_at IS NOT NULL AND _t.expires_at <= now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That code has expired.');
    END IF;
    IF _t.max_uses IS NOT NULL AND _t.times_used >= _t.max_uses THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That code has been used up.');
    END IF;
    IF _t.ends_at <= now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That trial has already ended.');
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'kind', 'trial', 'code', _t.code,
      'base', _t.base, 'ends_at', _t.ends_at
    );
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'That code doesn''t exist.');
END;
$function$;

revoke all on function public.validate_checkout_code(text) from public;
grant execute on function public.validate_checkout_code(text) to anon, authenticated;

-- Claiming the trial once the order exists. SECURITY DEFINER so the customer
-- never needs write access to bot_free_periods or the code table, and so the
-- product and the date are checked server-side rather than trusted from the
-- checkout form.
create or replace function public.claim_trial_for_order(_code text, _bot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  _user_id UUID := auth.uid();
  _t public.bot_free_period_codes%ROWTYPE;
  _bot public.bot_orders%ROWTYPE;
  _existing public.bot_free_periods%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  END IF;

  SELECT * INTO _t FROM public.bot_free_period_codes
   WHERE lower(code) = lower(trim(coalesce(_code, ''))) LIMIT 1;
  IF NOT FOUND
     OR NOT _t.is_active
     OR NOT coalesce(_t.teardown_on_expiry, false)
     OR _t.ends_at IS NULL
     OR _t.ends_at <= now()
     OR (_t.expires_at IS NOT NULL AND _t.expires_at <= now())
     OR (_t.max_uses IS NOT NULL AND _t.times_used >= _t.max_uses) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That trial code can''t be used.');
  END IF;

  SELECT * INTO _bot FROM public.bot_orders WHERE id = _bot_id;
  IF NOT FOUND OR _bot.user_id <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found.');
  END IF;

  IF _t.base IS NOT NULL AND lower(coalesce(_bot.base, '')) <> lower(_t.base) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'That code is only for ' || initcap(_t.base) || ' bots.'
    );
  END IF;

  -- Already claimed for this order: succeed without spending another use.
  SELECT * INTO _existing FROM public.bot_free_periods WHERE bot_id = _bot_id;
  IF FOUND AND _existing.teardown_on_expiry AND _existing.free_until = _t.ends_at THEN
    RETURN jsonb_build_object('ok', true, 'free_until', _t.ends_at, 'already', true);
  END IF;

  INSERT INTO public.bot_free_periods (bot_id, user_id, free_until, teardown_on_expiry)
  VALUES (_bot_id, _user_id, _t.ends_at, true)
  ON CONFLICT (bot_id) DO UPDATE
    SET free_until = EXCLUDED.free_until,
        user_id = EXCLUDED.user_id,
        teardown_on_expiry = true,
        reminder_sent_at = NULL,
        last_reminder_day = NULL,
        expired_at = NULL,
        resumed_at = NULL,
        updated_at = now();

  UPDATE public.bot_free_period_codes
     SET times_used = times_used + 1, updated_at = now()
   WHERE id = _t.id;

  INSERT INTO public.bot_free_period_redemptions
    (code_id, bot_id, user_id, months_granted, previous_free_until, new_free_until)
  VALUES (_t.id, _bot_id, _user_id, 0, NULL, _t.ends_at);

  RETURN jsonb_build_object('ok', true, 'free_until', _t.ends_at);
END;
$function$;

revoke all on function public.claim_trial_for_order(text, uuid) from public;
grant execute on function public.claim_trial_for_order(text, uuid) to authenticated;
