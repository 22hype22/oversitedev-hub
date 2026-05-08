-- 1. Extend bot_orders
ALTER TABLE public.bot_orders
  ADD COLUMN IF NOT EXISTS discord_user_id text,
  ADD COLUMN IF NOT EXISTS discord_username text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_setup_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS confirmation_state text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS confirmation_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_dm_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS charged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bot_orders_confirmation
  ON public.bot_orders (confirmation_state, confirmation_deadline_at)
  WHERE confirmation_state IN ('awaiting_yes_no', 'awaiting_username');

CREATE INDEX IF NOT EXISTS idx_bot_orders_discord_user
  ON public.bot_orders (discord_user_id)
  WHERE discord_user_id IS NOT NULL;

-- 2. DM conversation state (worker is stateless / multi-replica safe)
CREATE TABLE IF NOT EXISTS public.utility_bot_dm_state (
  discord_user_id text PRIMARY KEY,
  bot_order_id uuid NOT NULL,
  state text NOT NULL,
  expected_username text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.utility_bot_dm_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages dm state"
  ON public.utility_bot_dm_state FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- The utilities-bot worker uses the anon key, so allow anon to read/write
-- DM session rows (these are keyed by Discord ID, not user data).
CREATE POLICY "Anon manages dm state"
  ON public.utility_bot_dm_state FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. send_dm bot_commands policies (mirror the post_message ones)
CREATE POLICY "Anon can read send_dm commands"
  ON public.bot_commands FOR SELECT
  TO anon, authenticated
  USING (action = 'send_dm');

CREATE POLICY "Anon can update send_dm commands"
  ON public.bot_commands FOR UPDATE
  TO anon, authenticated
  USING (action = 'send_dm')
  WITH CHECK (action = 'send_dm');

-- 4. RPC: expire awaiting_confirmation orders past their deadline.
CREATE OR REPLACE FUNCTION public.expire_pending_confirmations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.bot_orders
       SET status = 'cancelled_timeout',
           confirmation_state = 'expired',
           cancelled_at = now(),
           cancellation_reason = 'no_response_within_24h',
           updated_at = now()
     WHERE status = 'awaiting_confirmation'
       AND confirmation_state IN ('awaiting_yes_no', 'awaiting_username')
       AND confirmation_deadline_at IS NOT NULL
       AND confirmation_deadline_at < now()
     RETURNING id, discord_user_id
  )
  DELETE FROM public.utility_bot_dm_state
   WHERE bot_order_id IN (SELECT id FROM expired);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_pending_confirmations() TO anon, authenticated, service_role;

-- 5. RPC: enqueue a send_dm command for the utilities bot.
-- bot_id/user_id/requested_by columns are NOT NULL, so we use placeholders
-- (the utilities bot is global; the order id is in the payload).
CREATE OR REPLACE FUNCTION public.enqueue_utilities_dm(
  _order_id uuid,
  _discord_user_id text,
  _message text,
  _kind text DEFAULT 'confirm_request'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_order public.bot_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.bot_orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found: %', _order_id;
  END IF;

  INSERT INTO public.bot_commands (
    bot_id, user_id, requested_by, action, status, payload
  ) VALUES (
    _order_id,           -- reuse order id as bot_id (utilities bot is global)
    v_order.user_id,
    v_order.user_id,
    'send_dm',
    'pending',
    jsonb_build_object(
      'discord_user_id', _discord_user_id,
      'message', _message,
      'order_id', _order_id,
      'kind', _kind
    )
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_utilities_dm(uuid, text, text, text) TO anon, authenticated, service_role;

-- 6. RPC: kick off the confirmation flow for one order. Called from the
-- Go Live sweeper. Sets status, deadline, conversation state, and enqueues
-- the first DM all in one transaction.
CREATE OR REPLACE FUNCTION public.start_order_confirmation(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.bot_orders%ROWTYPE;
  v_msg text;
BEGIN
  SELECT * INTO v_order FROM public.bot_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_order.discord_user_id IS NULL THEN RETURN false; END IF;
  IF v_order.status NOT IN ('waitlisted','preorder','draft') THEN RETURN false; END IF;

  UPDATE public.bot_orders
     SET status = 'awaiting_confirmation',
         confirmation_state = 'awaiting_yes_no',
         confirmation_dm_sent_at = now(),
         confirmation_deadline_at = now() + interval '24 hours',
         updated_at = now()
   WHERE id = _order_id;

  INSERT INTO public.utility_bot_dm_state (
    discord_user_id, bot_order_id, state, attempts
  ) VALUES (
    v_order.discord_user_id, _order_id, 'awaiting_yes_no', 0
  )
  ON CONFLICT (discord_user_id) DO UPDATE
    SET bot_order_id = EXCLUDED.bot_order_id,
        state = 'awaiting_yes_no',
        attempts = 0,
        updated_at = now();

  v_msg := format(
    'Hey! Your **Oversite Protection bot** is ready to be built. 🎉

Your bot: **%s**

Would you like to proceed with your order?
Reply **YES** to confirm or **NO** to cancel.

⏰ You have 24 hours to respond.',
    coalesce(v_order.bot_name, 'your bot')
  );

  PERFORM public.enqueue_utilities_dm(_order_id, v_order.discord_user_id, v_msg, 'confirm_request');
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_order_confirmation(uuid) TO anon, authenticated, service_role;

-- 7. Cron — sweep expired confirmations every 15 minutes.
-- pg_cron is already enabled in this project (existing jobs).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('expire-pending-confirmations')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-pending-confirmations');

    PERFORM cron.schedule(
      'expire-pending-confirmations',
      '*/15 * * * *',
      $cron$ SELECT public.expire_pending_confirmations(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
