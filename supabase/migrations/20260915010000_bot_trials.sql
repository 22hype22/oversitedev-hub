-- Free trials: a code that is good for one product, runs to a fixed date, and
-- takes the bot down when it ends.
--
-- The free-period machinery already here grants N months of free hosting on a
-- bot the customer already owns, and lets it lapse quietly into normal billing.
-- A trial is the other shape: it is offered for one product, it ends on a date
-- the operator picked rather than N months after redemption, the customer is
-- chased over the final days, and if they never buy, the bot goes away.
--
-- Rather than a second parallel system, the same tables carry both. A row with
-- teardown_on_expiry = false behaves exactly as before.

-- ── codes ────────────────────────────────────────────────────────────────────
alter table public.bot_free_period_codes
  -- Which product this code is good for ('dispatch', 'protection', …).
  -- NULL keeps the old behaviour: valid on any bot.
  add column if not exists base text,
  -- A fixed end date, instead of `months` counted from redemption. Two people
  -- redeeming the same promo a week apart should still end on the same day.
  add column if not exists ends_at timestamptz,
  -- Whether running out cancels the bot. false = the old "free hosting then
  -- normal billing" grant.
  add column if not exists teardown_on_expiry boolean not null default false;

comment on column public.bot_free_period_codes.base is
  'Product base this code may be redeemed against; NULL = any product.';
comment on column public.bot_free_period_codes.ends_at is
  'Fixed trial end. When set, redemption ignores `months` and never stacks.';
comment on column public.bot_free_period_codes.teardown_on_expiry is
  'true = a trial: the bot is cancelled when the period ends.';

-- ── granted periods ──────────────────────────────────────────────────────────
alter table public.bot_free_periods
  add column if not exists teardown_on_expiry boolean not null default false,
  -- Days-left value of the last countdown DM, so each day sends at most once
  -- and a missed day is not sent late as though it were today.
  add column if not exists last_reminder_day integer,
  -- Set once the trial has actually been acted on, so a cron re-run or a
  -- retried request can never cancel the same bot twice.
  add column if not exists expired_at timestamptz;

comment on column public.bot_free_periods.last_reminder_day is
  'Days remaining when the most recent countdown DM was sent.';
comment on column public.bot_free_periods.expired_at is
  'When the trial was enforced. Non-null means teardown already ran.';

-- The trial cron asks two questions daily: who is ending soon, and who has
-- ended and not been dealt with. Both are answered from this.
create index if not exists bot_free_periods_trial_due
  on public.bot_free_periods (free_until)
  where teardown_on_expiry and expired_at is null;

-- ── redemption ───────────────────────────────────────────────────────────────
create or replace function public.redeem_bot_free_period_code(_code text, _bot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  _user_id UUID := auth.uid();
  _code_row public.bot_free_period_codes%ROWTYPE;
  _bot_row public.bot_orders%ROWTYPE;
  _existing public.bot_free_periods%ROWTYPE;
  _base_time TIMESTAMP WITH TIME ZONE;
  _new_until TIMESTAMP WITH TIME ZONE;
  _previous TIMESTAMP WITH TIME ZONE;
  _months INTEGER;
  _is_trial BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You must be signed in to redeem a code.');
  END IF;

  IF _code IS NULL OR length(trim(_code)) = 0 OR length(_code) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please enter a valid code.');
  END IF;

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

  SELECT * INTO _bot_row
  FROM public.bot_orders
  WHERE id = _bot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.');
  END IF;

  IF _bot_row.user_id <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You can only redeem codes on your own bots.');
  END IF;

  -- A code tied to a product says so plainly, rather than "that code doesn't
  -- work" on a bot it was never meant for.
  IF _code_row.base IS NOT NULL
     AND lower(coalesce(_bot_row.base, '')) <> lower(_code_row.base) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'That code is only for ' || initcap(_code_row.base) || ' bots.'
    );
  END IF;

  _is_trial := coalesce(_code_row.teardown_on_expiry, false);

  SELECT * INTO _existing
  FROM public.bot_free_periods
  WHERE bot_id = _bot_id;

  IF _code_row.ends_at IS NOT NULL THEN
    -- Fixed end date: everyone on this promo ends together, so it neither
    -- stacks onto an existing period nor counts from today.
    IF _code_row.ends_at <= now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'That trial has already ended.');
    END IF;
    IF FOUND AND _existing.free_until >= _code_row.ends_at THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'This bot is already free past that date.'
      );
    END IF;
    _previous := CASE WHEN FOUND AND _existing.free_until > now()
                      THEN _existing.free_until ELSE NULL END;
    _new_until := _code_row.ends_at;
    _months := NULL;
  ELSE
    -- Months from now, stacking onto any period still running.
    IF FOUND AND _existing.free_until > now() THEN
      _base_time := _existing.free_until;
      _previous := _existing.free_until;
    ELSE
      _base_time := now();
      _previous := NULL;
    END IF;
    _months := _code_row.months;
    _new_until := _base_time + (_code_row.months || ' months')::interval;
  END IF;

  INSERT INTO public.bot_free_periods
    (bot_id, user_id, free_until, teardown_on_expiry)
  VALUES (_bot_id, _user_id, _new_until, _is_trial)
  ON CONFLICT (bot_id) DO UPDATE
    SET free_until = EXCLUDED.free_until,
        user_id = EXCLUDED.user_id,
        teardown_on_expiry = EXCLUDED.teardown_on_expiry,
        reminder_sent_at = NULL,
        last_reminder_day = NULL,
        expired_at = NULL,
        resumed_at = NULL,
        updated_at = now();

  UPDATE public.bot_free_period_codes
     SET times_used = times_used + 1,
         updated_at = now()
   WHERE id = _code_row.id;

  INSERT INTO public.bot_free_period_redemptions
    (code_id, bot_id, user_id, months_granted, previous_free_until, new_free_until)
  VALUES
    (_code_row.id, _bot_id, _user_id, coalesce(_months, 0), _previous, _new_until);

  RETURN jsonb_build_object(
    'ok', true,
    'months_granted', _months,
    'free_until', _new_until,
    'trial', _is_trial,
    'stacked', _previous IS NOT NULL
  );
END;
$function$;

-- ── daily trial enforcement ──────────────────────────────────────────────────
-- Runs after the hosting-grace job so the two never fight over the same bot in
-- the same minute.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('enforce-free-trials-daily')
      where exists (select 1 from cron.job where jobname = 'enforce-free-trials-daily');
    perform cron.schedule(
      'enforce-free-trials-daily',
      '45 3 * * *',
      $cron$
      SELECT net.http_post(
        url := (SELECT fn_url FROM public.deploy_config WHERE id = 1) || '/enforce-free-trials',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT anon_key FROM public.deploy_config WHERE id = 1),
          'x-internal-secret', (SELECT coalesce(internal_secret, '') FROM public.deploy_config WHERE id = 1)
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  end if;
end $$;
