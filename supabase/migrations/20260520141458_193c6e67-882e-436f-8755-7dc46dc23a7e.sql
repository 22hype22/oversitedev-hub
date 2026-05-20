CREATE OR REPLACE FUNCTION public.team_confirm_ownership_transfer(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.dashboard_team;
  _caller_email text;
  _moved_count int := 0;
  _new_owner uuid;
  _old_owner uuid;
  _old_owner_email text;
  _bot_ids uuid[];
  _old_owner_had_dashboard boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;

  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid token');
  END IF;

  SELECT * INTO _row
    FROM public.dashboard_team
   WHERE transfer_token = _token
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid or expired token');
  END IF;

  IF _row.transfer_requested_at < now() - interval '7 days' THEN
    UPDATE public.dashboard_team
       SET transfer_token = NULL,
           transfer_requested_at = NULL,
           transfer_requested_by = NULL,
           transfer_bot_ids = NULL
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
       SET member_user_id = auth.uid(),
           accepted_at = COALESCE(accepted_at, now())
     WHERE id = _row.id;
  END IF;

  _new_owner := auth.uid();
  _old_owner := _row.owner_user_id;
  _bot_ids := _row.transfer_bot_ids;

  SELECT email INTO _old_owner_email FROM auth.users WHERE id = _old_owner;

  IF _bot_ids IS NOT NULL AND array_length(_bot_ids, 1) IS NOT NULL THEN
    WITH locked_bots AS (
      SELECT id FROM public.bot_orders
       WHERE user_id = _old_owner AND id = ANY(_bot_ids)
       FOR UPDATE
    )
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO _bot_ids FROM locked_bots;

    IF array_length(_bot_ids, 1) IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.bot_orders
         WHERE user_id = _old_owner
           AND 'dashboard' = ANY(addons)
           AND (paid_at IS NOT NULL OR status IN ('paid', 'ready'))
      ) INTO _old_owner_had_dashboard;

      UPDATE public.bot_orders
         SET user_id = _new_owner,
             addons = CASE
               WHEN _old_owner_had_dashboard AND NOT ('dashboard' = ANY(addons))
                 THEN array_append(addons, 'dashboard')
               ELSE addons
             END,
             updated_at = now()
       WHERE id = ANY(_bot_ids) AND user_id = _old_owner;
      GET DIAGNOSTICS _moved_count = ROW_COUNT;

      IF _moved_count <> array_length(_bot_ids, 1) THEN
        RAISE EXCEPTION 'ownership transfer moved % of % bots', _moved_count, array_length(_bot_ids, 1);
      END IF;

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
      UPDATE public.dashboard_addon_order       SET user_id = _new_owner WHERE bot_id  = ANY(_bot_ids) AND user_id = _old_owner;
    END IF;
  END IF;

  -- ── Team membership migration ─────────────────────────────────────────
  -- The recipient was a team member of the old owner. Remove that row so
  -- they don't appear as a member of themselves after they become owner.
  DELETE FROM public.dashboard_team
   WHERE owner_user_id = _old_owner
     AND id = _row.id;

  -- Re-key every remaining team member of the old owner under the new owner.
  -- If the new owner already has a member row for the same email, skip it.
  UPDATE public.dashboard_team t
     SET owner_user_id = _new_owner,
         updated_at = now()
   WHERE t.owner_user_id = _old_owner
     AND NOT EXISTS (
       SELECT 1 FROM public.dashboard_team x
        WHERE x.owner_user_id = _new_owner
          AND lower(x.member_email) = lower(t.member_email)
     );
  -- Drop any rows that couldn't be re-keyed due to email conflict.
  DELETE FROM public.dashboard_team WHERE owner_user_id = _old_owner;

  -- Add the previous owner to the new owner's team as a viewer.
  IF _old_owner_email IS NOT NULL AND _old_owner <> _new_owner THEN
    INSERT INTO public.dashboard_team
      (owner_user_id, member_email, member_user_id, role, invited_by, invited_at, accepted_at)
    VALUES
      (_new_owner, _old_owner_email, _old_owner, 'viewer', _new_owner, now(), now())
    ON CONFLICT (owner_user_id, lower(member_email))
    DO UPDATE SET role = 'viewer',
                  member_user_id = COALESCE(public.dashboard_team.member_user_id, EXCLUDED.member_user_id),
                  accepted_at    = COALESCE(public.dashboard_team.accepted_at, EXCLUDED.accepted_at),
                  updated_at     = now();
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'owner_user_id', _old_owner,
    'previous_owner_email', _old_owner_email,
    'transfer_id', _row.id,
    'bots_transferred', _moved_count,
    'dashboard_entitlement_transferred', _old_owner_had_dashboard,
    'team_preserved', true,
    'previous_owner_added_as_viewer', true
  );
END;
$function$;