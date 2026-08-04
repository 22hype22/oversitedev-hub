-- Rebuild ownership transfer so it ACTUALLY transfers ownership.
--
-- The problem: ownership of a bot is determined by `bot_orders.user_id`
-- (that's what team_get_effective_role / has_bot_team_perm key off). The old
-- confirm function only swapped `dashboard_team.role` values and never touched
-- `bot_orders.user_id`, so the "new owner" ended up owning nothing — and the
-- request/confirm pair was out of sync (a 1-arg request committed, a 2-arg
-- request live), which is why confirming failed with "invalid or expired token".
--
-- This replaces both functions with a self-consistent pair that moves the real
-- ownership record for the SELECTED bots:
--   * bot_orders.user_id -> new owner (the money/ownership record)
--   * the old owner is kept on each bot as a co_owner team member
--   * every other team member on those bots is re-pointed to the new owner
--   * the bot is detached from the old owner's group (group_id -> NULL) so it
--     doesn't dangle under a group the new owner can't see
--
-- Billing: the dispatch bot is a one-time upfront purchase with no monthly
-- charge, so there is no subscription to move. Bots that DO carry monthly
-- hosting would need their Stripe subscription re-pointed separately; that is
-- intentionally left to a billing-specific flow and is a no-op here.
--
-- The transfer handshake is stored on the target member's dashboard_team row
-- using the existing transfer_* columns (incl. transfer_bot_ids), so the
-- team-transfer-send edge function and the dashboard TransferModal keep working
-- unchanged.

-- Make sure the columns this relies on exist (added live via Lovable; guard so
-- the migration also applies cleanly on a fresh database).
ALTER TABLE public.dashboard_team
  ADD COLUMN IF NOT EXISTS transfer_token text,
  ADD COLUMN IF NOT EXISTS transfer_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS transfer_requested_by uuid,
  ADD COLUMN IF NOT EXISTS transfer_bot_ids uuid[];

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_team_transfer_token_idx
  ON public.dashboard_team(transfer_token) WHERE transfer_token IS NOT NULL;

-- Drop the stale 1-arg overload so there is exactly one request function.
DROP FUNCTION IF EXISTS public.team_request_ownership_transfer(uuid);

-- =========================================================================
-- Owner initiates a transfer of a specific set of bots to a team member.
-- Stores the handshake (token + bot ids) on that member's dashboard_team row
-- and returns the token so the edge function can email a confirmation link.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.team_request_ownership_transfer(
  _member_id uuid,
  _bot_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.dashboard_team;
  _owner uuid := auth.uid();
  _valid uuid[];
  _token text;
BEGIN
  IF _owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;

  SELECT * INTO _row FROM public.dashboard_team WHERE id = _member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member not found');
  END IF;
  IF _row.owner_user_id <> _owner THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not owner');
  END IF;
  IF _row.accepted_at IS NULL OR _row.member_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'member has not accepted their invite yet');
  END IF;
  IF _row.member_user_id = _owner THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot transfer to yourself');
  END IF;

  -- Keep only bots the caller actually owns right now.
  SELECT COALESCE(array_agg(bo.id), '{}')
    INTO _valid
    FROM public.bot_orders bo
   WHERE bo.user_id = _owner
     AND bo.id = ANY(COALESCE(_bot_ids, '{}'::uuid[]));

  IF _valid IS NULL OR array_length(_valid, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no transferable bots selected');
  END IF;

  _token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  UPDATE public.dashboard_team
     SET transfer_token = _token,
         transfer_requested_at = now(),
         transfer_requested_by = _owner,
         transfer_bot_ids = _valid,
         updated_at = now()
   WHERE id = _member_id;

  RETURN jsonb_build_object(
    'ok', true,
    'transfer_token', _token,
    'id', _member_id,
    'member_email', _row.member_email,
    'bot_ids', _valid
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_request_ownership_transfer(uuid, uuid[]) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.team_request_ownership_transfer(uuid, uuid[]) TO authenticated;

-- =========================================================================
-- Owner cancels a pending transfer (clears the handshake).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.team_cancel_ownership_transfer(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  UPDATE public.dashboard_team
     SET transfer_token = NULL,
         transfer_requested_at = NULL,
         transfer_requested_by = NULL,
         transfer_bot_ids = NULL,
         updated_at = now()
   WHERE id = _member_id AND owner_user_id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_cancel_ownership_transfer(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.team_cancel_ownership_transfer(uuid) TO authenticated;

-- =========================================================================
-- Target member confirms the transfer using the emailed token. Must be signed
-- in as that member (matched by user id or email). Moves real ownership of the
-- selected bots and keeps the previous owner on as a co_owner.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.team_confirm_ownership_transfer(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.dashboard_team;
  _to uuid := auth.uid();
  _from uuid;
  _to_email text;
  _from_email text;
  _bot_ids uuid[];
  _bot uuid;
  _moved uuid[] := '{}';
BEGIN
  IF _to IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid token');
  END IF;

  SELECT * INTO _row FROM public.dashboard_team WHERE transfer_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid or expired token');
  END IF;

  -- Expire after 7 days.
  IF _row.transfer_requested_at < now() - interval '7 days' THEN
    UPDATE public.dashboard_team
       SET transfer_token = NULL, transfer_requested_at = NULL,
           transfer_requested_by = NULL, transfer_bot_ids = NULL
     WHERE id = _row.id;
    RETURN jsonb_build_object('ok', false, 'error', 'this transfer link has expired');
  END IF;

  SELECT email INTO _to_email FROM auth.users WHERE id = _to;
  -- The confirming user must be the intended recipient.
  IF NOT (
    _row.member_user_id = _to
    OR lower(_row.member_email) = lower(COALESCE(_to_email, ''))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'this transfer is for a different account');
  END IF;

  _from := _row.owner_user_id;
  IF _from = _to THEN
    RETURN jsonb_build_object('ok', false, 'error', 'you already own these bots');
  END IF;
  SELECT email INTO _from_email FROM auth.users WHERE id = _from;
  _to_email := COALESCE(_to_email, _row.member_email);

  _bot_ids := _row.transfer_bot_ids;
  IF _bot_ids IS NULL OR array_length(_bot_ids, 1) IS NULL THEN
    -- Clear the dangling handshake and report nothing to do.
    UPDATE public.dashboard_team
       SET transfer_token = NULL, transfer_requested_at = NULL,
           transfer_requested_by = NULL, transfer_bot_ids = NULL
     WHERE id = _row.id;
    RETURN jsonb_build_object('ok', false, 'error', 'no bots were attached to this transfer');
  END IF;

  FOREACH _bot IN ARRAY _bot_ids LOOP
    -- Only move bots the requester still owns.
    UPDATE public.bot_orders
       SET user_id = _to,
           group_id = NULL,        -- detach from the old owner's group
           updated_at = now()
     WHERE id = _bot AND user_id = _from;

    IF NOT FOUND THEN
      CONTINUE;  -- ownership changed since the request; skip this bot
    END IF;

    -- The new owner no longer needs a member row on a bot they now own.
    DELETE FROM public.dashboard_team
     WHERE bot_id = _bot AND lower(member_email) = lower(_to_email);

    -- Re-point every remaining member of this bot to the new owner so RLS and
    -- permission checks (which key off owner_user_id) resolve correctly.
    UPDATE public.dashboard_team
       SET owner_user_id = _to, updated_at = now()
     WHERE bot_id = _bot AND owner_user_id = _from;

    -- Keep the previous owner on the bot as a co_owner.
    INSERT INTO public.dashboard_team
      (bot_id, owner_user_id, member_email, member_user_id, role,
       invited_by, invited_at, accepted_at, updated_at)
    VALUES
      (_bot, _to, COALESCE(_from_email, ''), _from, 'co_owner',
       _to, now(), now(), now())
    ON CONFLICT (bot_id, lower(member_email)) DO UPDATE
      SET owner_user_id = _to,
          member_user_id = _from,
          role = 'co_owner',
          accepted_at = COALESCE(dashboard_team.accepted_at, now()),
          updated_at = now();

    _moved := array_append(_moved, _bot);
  END LOOP;

  -- Clear the handshake wherever it still lives (the target's row may have been
  -- deleted above if its bot was among the transferred set).
  UPDATE public.dashboard_team
     SET transfer_token = NULL, transfer_requested_at = NULL,
         transfer_requested_by = NULL, transfer_bot_ids = NULL
   WHERE transfer_token = _token;

  IF array_length(_moved, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'these bots are no longer owned by the sender');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'owner_user_id', _to,
    'bot_ids', _moved
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_confirm_ownership_transfer(text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.team_confirm_ownership_transfer(text) TO authenticated;
