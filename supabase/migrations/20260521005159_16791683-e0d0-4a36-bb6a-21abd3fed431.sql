-- 1) Backfill: every bot_orders row needs an owner row in dashboard_team.
INSERT INTO public.dashboard_team (bot_id, owner_user_id, member_user_id, member_email, role, accepted_at)
SELECT bo.id, bo.user_id, bo.user_id, lower(u.email), 'owner', now()
FROM public.bot_orders bo
JOIN auth.users u ON u.id = bo.user_id
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.dashboard_team dt
    WHERE dt.bot_id = bo.id
      AND dt.member_user_id = bo.user_id
      AND dt.role = 'owner'
  )
ON CONFLICT (bot_id, lower(member_email)) DO UPDATE
  SET role = 'owner',
      member_user_id = COALESCE(public.dashboard_team.member_user_id, EXCLUDED.member_user_id),
      accepted_at = COALESCE(public.dashboard_team.accepted_at, now());

-- 2) Trigger function: auto-insert owner row for new bot_orders.
CREATE OR REPLACE FUNCTION public.dashboard_team_seed_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = NEW.user_id;
  IF _email IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.dashboard_team (bot_id, owner_user_id, member_user_id, member_email, role, accepted_at)
  VALUES (NEW.id, NEW.user_id, NEW.user_id, lower(_email), 'owner', now())
  ON CONFLICT (bot_id, lower(member_email)) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_orders_seed_team_owner ON public.bot_orders;
CREATE TRIGGER bot_orders_seed_team_owner
AFTER INSERT ON public.bot_orders
FOR EACH ROW
EXECUTE FUNCTION public.dashboard_team_seed_owner();

-- 3) Update ensure_team_owner_row to be per-bot aware.
CREATE OR REPLACE FUNCTION public.ensure_team_owner_row(_bot_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _uid uuid;
BEGIN
  _uid := auth.uid();
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  IF _email IS NULL THEN RETURN; END IF;

  IF _bot_id IS NOT NULL THEN
    -- Only seed if the caller owns this bot.
    IF EXISTS (SELECT 1 FROM public.bot_orders WHERE id = _bot_id AND user_id = _uid) THEN
      INSERT INTO public.dashboard_team (bot_id, owner_user_id, member_user_id, member_email, role, accepted_at)
      VALUES (_bot_id, _uid, _uid, lower(_email), 'owner', now())
      ON CONFLICT (bot_id, lower(member_email)) DO UPDATE
        SET role = 'owner',
            member_user_id = COALESCE(public.dashboard_team.member_user_id, EXCLUDED.member_user_id),
            accepted_at = COALESCE(public.dashboard_team.accepted_at, now());
    END IF;
  ELSE
    -- Seed across all bots owned by the caller (used by older callers).
    INSERT INTO public.dashboard_team (bot_id, owner_user_id, member_user_id, member_email, role, accepted_at)
    SELECT bo.id, _uid, _uid, lower(_email), 'owner', now()
    FROM public.bot_orders bo
    WHERE bo.user_id = _uid
    ON CONFLICT (bot_id, lower(member_email)) DO UPDATE
      SET role = 'owner',
          member_user_id = COALESCE(public.dashboard_team.member_user_id, EXCLUDED.member_user_id),
          accepted_at = COALESCE(public.dashboard_team.accepted_at, now());
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_team_owner_row(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_team_owner_row(uuid) TO authenticated;