
CREATE OR REPLACE FUNCTION public.team_confirm_ownership_transfer(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.dashboard_team;
  _caller_email text;
  _moved_count int;
  _new_owner uuid;
  _old_owner uuid;
  _bot_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid token');
  END IF;
  SELECT * INTO _row FROM public.dashboard_team WHERE transfer_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid or expired token');
  END IF;
  IF _row.transfer_requested_at < now() - interval '7 days' THEN
    UPDATE public.dashboard_team
       SET transfer_token = NULL, transfer_requested_at = NULL,
           transfer_requested_by = NULL, transfer_bot_ids = NULL
     WHERE id = _row.id;
    RETURN jsonb_build_object('ok', false, 'error', 'token expired');
  END IF;
  SELECT email INTO _caller_email FROM auth.users WHERE id = auth.uid();
  IF NOT (
    _row.member_user_id = auth.uid()
    OR lower(_row.member_email) = lower(COALESCE(_caller_email, ''))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'this transfer is for a different account');
  END IF;
  IF _row.accepted_at IS NULL OR _row.member_user_id IS NULL THEN
    UPDATE public.dashboard_team
       SET member_user_id = auth.uid(), accepted_at = COALESCE(accepted_at, now())
     WHERE id = _row.id;
  END IF;

  _new_owner := auth.uid();
  _old_owner := _row.owner_user_id;
  _bot_ids := _row.transfer_bot_ids;

  IF _bot_ids IS NULL OR array_length(_bot_ids, 1) IS NULL THEN
    _moved_count := 0;
  ELSE
    -- Restrict to bots still owned by the original owner to avoid touching
    -- anything that has since changed hands.
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO _bot_ids
      FROM public.bot_orders
     WHERE user_id = _old_owner AND id = ANY(_bot_ids);

    IF array_length(_bot_ids, 1) IS NULL THEN
      _moved_count := 0;
    ELSE
      -- Atomically reassign across all owner-scoped tables. If any of these
      -- fail, the SECURITY DEFINER function aborts and nothing is changed —
      -- the original owner retains full access.
      UPDATE public.bot_orders                  SET user_id = _new_owner WHERE id      = ANY(_bot_ids) AND user_id = _old_owner;
      GET DIAGNOSTICS _moved_count = ROW_COUNT;

      UPDATE public.bot_secrets                 SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_credits                 SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_server_slots            SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_runtime_status          SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_usage_metrics           SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_active_guilds           SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_logs                    SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_commands                SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_notifications           SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_channel_cache           SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_role_cache              SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_free_periods            SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_free_period_redemptions SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_dashboard_redemptions   SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_pending_discounts       SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_say_drafts              SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
      UPDATE public.bot_build_jobs              SET user_id = _new_owner WHERE order_id = ANY(_bot_ids) AND user_id = _old_owner;
    END IF;
  END IF;

  -- Clear transfer markers; leave team roles untouched (per-bot transfer model).
  UPDATE public.dashboard_team
     SET transfer_token = NULL,
         transfer_requested_at = NULL,
         transfer_requested_by = NULL,
         transfer_bot_ids = NULL
   WHERE id = _row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'owner_user_id', _old_owner,
    'previous_owner_email', (SELECT email FROM auth.users WHERE id = _old_owner),
    'transfer_id', _row.id,
    'bots_transferred', _moved_count
  );
END;
$function$;
