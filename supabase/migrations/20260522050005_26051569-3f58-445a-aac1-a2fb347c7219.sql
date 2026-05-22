CREATE OR REPLACE FUNCTION public.promote_waitlisted_order_on_token_available()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order public.bot_orders%ROWTYPE;
  _msg text;
BEGIN
  -- Only act when a token transitions INTO 'available'.
  IF NEW.status <> 'available' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'available' THEN
    RETURN NEW;
  END IF;

  -- Pick the oldest waitlisted order that either hasn't been asked yet, or
  -- whose previous "still want to proceed?" DM is older than 48 hours.
  SELECT * INTO _order
    FROM public.bot_orders
   WHERE status = 'waitlisted'
     AND discord_user_id IS NOT NULL
     AND (
       confirmation_state IS DISTINCT FROM 'awaiting_yes_no'
       OR confirmation_dm_sent_at IS NULL
       OR confirmation_dm_sent_at < now() - interval '48 hours'
     )
   ORDER BY COALESCE(paid_at, submitted_at, created_at) ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF _order.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mark order as awaiting the customer's "yes I still want it" reply.
  -- Status stays 'waitlisted' until they confirm; the worker's DM handler
  -- flips it to 'paid' on YES, which then auto-deploys via the existing chain.
  UPDATE public.bot_orders
     SET confirmation_state = 'awaiting_yes_no',
         confirmation_dm_sent_at = now(),
         confirmation_deadline_at = now() + interval '48 hours',
         updated_at = now()
   WHERE id = _order.id;

  INSERT INTO public.utility_bot_dm_state (
    discord_user_id, bot_order_id, state, attempts
  ) VALUES (
    _order.discord_user_id, _order.id, 'awaiting_yes_no', 0
  )
  ON CONFLICT (discord_user_id) DO UPDATE
    SET bot_order_id = EXCLUDED.bot_order_id,
        state = 'awaiting_yes_no',
        attempts = 0,
        updated_at = now();

  _msg := format(
    'Good news — a bot slot just opened up and your Oversite preorder for **%s** is next in line! 🎉

Would you like to proceed and deploy now?
Reply **YES** to deploy or **NO** to cancel.

⏰ You have 48 hours to respond. If we don''t hear back, we''ll keep you on the waitlist and DM you again the next time a slot opens.',
    coalesce(_order.bot_name, 'your bot')
  );

  PERFORM public.enqueue_utilities_dm(
    _order.id, _order.discord_user_id, _msg, 'proceed_request'
  );

  RETURN NEW;
END;
$$;