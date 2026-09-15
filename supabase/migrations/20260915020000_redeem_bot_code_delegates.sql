-- redeem_bot_code is the one the Bot Dashboard actually calls, and it carried
-- its own copy of the free-period logic rather than calling the free-period
-- function. Two copies meant the trial rules (product gating, fixed end date,
-- teardown) landed in one and not the other, so a trial code redeemed from the
-- dashboard would have been treated as a plain one-month grant.
--
-- The free-period branch now delegates. redeem_bot_code keeps what is its own:
-- deciding which kind of code this is, and the dashboard redemption log.

create or replace function public.redeem_bot_code(_code text, _bot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  _user_id UUID := auth.uid();
  _bot_row public.bot_orders%ROWTYPE;
  _trimmed TEXT;
  _free public.bot_free_period_codes%ROWTYPE;
  _disc public.discount_codes%ROWTYPE;
  _res JSONB;
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

  SELECT * INTO _bot_row FROM public.bot_orders WHERE id = _bot_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.');
  END IF;
  IF _bot_row.user_id <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You can only redeem codes on your own bots.');
  END IF;

  -- Free-period / trial code.
  SELECT * INTO _free FROM public.bot_free_period_codes
   WHERE lower(code) = lower(_trimmed) LIMIT 1;

  IF FOUND THEN
    _res := public.redeem_bot_free_period_code(_trimmed, _bot_id);
    IF coalesce((_res ->> 'ok')::boolean, false) THEN
      INSERT INTO public.bot_dashboard_redemptions
        (user_id, bot_id, code, code_type, free_period_code_id, months_granted)
      VALUES (
        _user_id, _bot_id, _trimmed,
        CASE WHEN coalesce(_free.teardown_on_expiry, false) THEN 'free_trial' ELSE 'free_period' END,
        _free.id,
        nullif(_res ->> 'months_granted', '')::int
      );
    END IF;
    RETURN _res || jsonb_build_object('type', 'free_period');
  END IF;

  -- Discount code.
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
$function$;
