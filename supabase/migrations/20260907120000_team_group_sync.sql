-- Team access that follows groups.
--
-- How access works:
--   * A seat is one row in dashboard_team: this person, this bot, this role.
--   * Someone given the whole dashboard has a seat on every bot the owner has,
--     and (new here) is flagged all_bots so bots the owner adds later get a
--     seat for them automatically.
--   * Someone given a group has a seat on each bot in that group, and (new
--     here) the seat records the group. When the owner moves a bot into or
--     out of that group, seats follow: the bot gains seats for the group's
--     members, or loses the seats that came from the group.
--   * Seats created by identity rules (Discord role, Roblox rank, and so on)
--     carry access_grant_id and are left alone; the resolver keeps those in
--     step on its own.
--   * What a seat lets someone do is the role's permissions. Owners can set
--     per-group overrides; the permission check now prefers the override for
--     the bot's own group, then the account-wide one, then the defaults.
--
-- Everything here is additive and safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Seat scope on dashboard_team
-- ---------------------------------------------------------------------------
ALTER TABLE public.dashboard_team
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS all_bots boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS dashboard_team_owner_group_idx
  ON public.dashboard_team (owner_user_id, group_id);

-- Backfill: work out, per person per owner, whether their existing seats
-- cover every bot (whole dashboard) or exactly one group's bots.
DO $$
DECLARE
  r record;
  _all_count int;
  _seat_count int;
  _group uuid;
  _groups int;
BEGIN
  FOR r IN
    SELECT owner_user_id, lower(member_email) AS em
      FROM public.dashboard_team
     WHERE role <> 'owner' AND access_grant_id IS NULL
     GROUP BY owner_user_id, lower(member_email)
  LOOP
    SELECT count(*) INTO _all_count FROM public.bot_orders WHERE user_id = r.owner_user_id;
    SELECT count(DISTINCT t.bot_id) INTO _seat_count
      FROM public.dashboard_team t
     WHERE t.owner_user_id = r.owner_user_id AND lower(t.member_email) = r.em AND t.role <> 'owner';
    IF _all_count > 0 AND _seat_count >= _all_count THEN
      UPDATE public.dashboard_team SET all_bots = true, group_id = NULL
       WHERE owner_user_id = r.owner_user_id AND lower(member_email) = r.em AND role <> 'owner' AND access_grant_id IS NULL;
      CONTINUE;
    END IF;
    SELECT count(DISTINCT bo.group_id), min(bo.group_id::text)::uuid INTO _groups, _group
      FROM public.dashboard_team t
      JOIN public.bot_orders bo ON bo.id = t.bot_id
     WHERE t.owner_user_id = r.owner_user_id AND lower(t.member_email) = r.em AND t.role <> 'owner'
       AND bo.group_id IS NOT NULL;
    IF _groups = 1 AND _group IS NOT NULL THEN
      UPDATE public.dashboard_team SET group_id = _group
       WHERE owner_user_id = r.owner_user_id AND lower(member_email) = r.em AND role <> 'owner' AND access_grant_id IS NULL AND group_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Seats follow bots: new bots, and bots moving between groups
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.team_seed_new_bot_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Whole-dashboard members get a seat on every new bot.
  INSERT INTO public.dashboard_team (
    bot_id, owner_user_id, member_email, member_user_id, role,
    invite_token, invited_by, accepted_at, all_bots, group_id
  )
  SELECT DISTINCT ON (lower(t.member_email))
         NEW.id, NEW.user_id, t.member_email, t.member_user_id, t.role,
         t.invite_token, t.invited_by, t.accepted_at, true, NULL
    FROM public.dashboard_team t
   WHERE t.owner_user_id = NEW.user_id
     AND t.all_bots = true
     AND t.role <> 'owner'
     AND t.access_grant_id IS NULL
   ORDER BY lower(t.member_email), t.accepted_at DESC NULLS LAST
  ON CONFLICT (bot_id, lower(member_email)) DO NOTHING;

  -- If the bot is created straight into a group, that group's members get it too.
  IF NEW.group_id IS NOT NULL THEN
    INSERT INTO public.dashboard_team (
      bot_id, owner_user_id, member_email, member_user_id, role,
      invite_token, invited_by, accepted_at, all_bots, group_id
    )
    SELECT DISTINCT ON (lower(t.member_email))
           NEW.id, NEW.user_id, t.member_email, t.member_user_id, t.role,
           t.invite_token, t.invited_by, t.accepted_at, false, NEW.group_id
      FROM public.dashboard_team t
     WHERE t.owner_user_id = NEW.user_id
       AND t.group_id = NEW.group_id
       AND t.role <> 'owner'
       AND t.access_grant_id IS NULL
     ORDER BY lower(t.member_email), t.accepted_at DESC NULLS LAST
    ON CONFLICT (bot_id, lower(member_email)) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_orders_seed_team_seats ON public.bot_orders;
CREATE TRIGGER bot_orders_seed_team_seats
AFTER INSERT ON public.bot_orders
FOR EACH ROW
EXECUTE FUNCTION public.team_seed_new_bot_seats();

CREATE OR REPLACE FUNCTION public.team_sync_bot_group_seats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS NOT DISTINCT FROM OLD.group_id THEN
    RETURN NEW;
  END IF;

  -- Leaving a group: seats that came from that group go with it.
  IF OLD.group_id IS NOT NULL THEN
    DELETE FROM public.dashboard_team
     WHERE bot_id = NEW.id
       AND group_id = OLD.group_id
       AND all_bots = false
       AND role <> 'owner'
       AND access_grant_id IS NULL;
  END IF;

  -- Joining a group: everyone with a seat in that group gets this bot.
  IF NEW.group_id IS NOT NULL THEN
    INSERT INTO public.dashboard_team (
      bot_id, owner_user_id, member_email, member_user_id, role,
      invite_token, invited_by, accepted_at, all_bots, group_id
    )
    SELECT DISTINCT ON (lower(t.member_email))
           NEW.id, NEW.user_id, t.member_email, t.member_user_id, t.role,
           t.invite_token, t.invited_by, t.accepted_at, false, NEW.group_id
      FROM public.dashboard_team t
     WHERE t.owner_user_id = NEW.user_id
       AND t.group_id = NEW.group_id
       AND t.bot_id <> NEW.id
       AND t.role <> 'owner'
       AND t.access_grant_id IS NULL
     ORDER BY lower(t.member_email), t.accepted_at DESC NULLS LAST
    ON CONFLICT (bot_id, lower(member_email)) DO UPDATE
      SET role = EXCLUDED.role,
          group_id = EXCLUDED.group_id,
          member_user_id = COALESCE(public.dashboard_team.member_user_id, EXCLUDED.member_user_id),
          accepted_at = COALESCE(public.dashboard_team.accepted_at, EXCLUDED.accepted_at),
          updated_at = now()
      WHERE public.dashboard_team.all_bots = false AND public.dashboard_team.role <> 'owner';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_orders_sync_team_group_seats ON public.bot_orders;
CREATE TRIGGER bot_orders_sync_team_group_seats
AFTER UPDATE OF group_id ON public.bot_orders
FOR EACH ROW
EXECUTE FUNCTION public.team_sync_bot_group_seats();

-- ---------------------------------------------------------------------------
-- 3. Invites record their scope
-- ---------------------------------------------------------------------------
-- Whole dashboard: every bot now, and every bot later (all_bots).
CREATE OR REPLACE FUNCTION public.team_invite_member_all_owner_bots(_email text, _role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token text;
  _matched_user uuid;
  _normalized text := lower(trim(_email));
  _uid uuid := auth.uid();
  _bot record;
  _first_id uuid;
  _bot_count int := 0;
  _existing_token text;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF _normalized = '' OR _normalized !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid email');
  END IF;
  IF _role NOT IN ('co_owner','admin','moderator','viewer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid role');
  END IF;

  SELECT invite_token INTO _existing_token
    FROM public.dashboard_team
   WHERE owner_user_id = _uid
     AND lower(member_email) = _normalized
     AND invite_token IS NOT NULL
   LIMIT 1;
  _token := COALESCE(_existing_token,
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

  SELECT id INTO _matched_user FROM auth.users WHERE lower(email) = _normalized LIMIT 1;

  FOR _bot IN
    SELECT id FROM public.bot_orders WHERE user_id = _uid
  LOOP
    INSERT INTO public.dashboard_team (
      owner_user_id, member_email, member_user_id, role,
      invite_token, invited_by, accepted_at, bot_id, all_bots, group_id
    ) VALUES (
      _uid, _normalized, _matched_user, _role,
      _token, _uid,
      CASE WHEN _matched_user IS NOT NULL THEN now() ELSE NULL END,
      _bot.id, true, NULL
    )
    ON CONFLICT (bot_id, lower(member_email)) DO UPDATE
      SET role = EXCLUDED.role,
          all_bots = true,
          group_id = NULL,
          invite_token = COALESCE(public.dashboard_team.invite_token, EXCLUDED.invite_token),
          member_user_id = COALESCE(public.dashboard_team.member_user_id, EXCLUDED.member_user_id),
          invited_at = now()
    RETURNING id INTO _first_id;
    _bot_count := _bot_count + 1;
  END LOOP;

  IF _bot_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no bots to invite to');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', _first_id, 'invite_token', _token, 'bot_count', _bot_count);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.team_invite_member_all_owner_bots(text, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.team_invite_member_all_owner_bots(text, text) TO authenticated;

-- One group: the bots in it now, and bots moved into it later (group_id).
CREATE OR REPLACE FUNCTION public.team_invite_member_group_v2(_email text, _role text, _group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token text;
  _matched_user uuid;
  _normalized text := lower(trim(_email));
  _uid uuid := auth.uid();
  _bot record;
  _first_id uuid;
  _bot_count int := 0;
  _existing_token text;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  IF _group_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'group required');
  END IF;
  IF _normalized = '' OR _normalized !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid email');
  END IF;
  IF _role NOT IN ('co_owner','admin','moderator','viewer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid role');
  END IF;

  SELECT invite_token INTO _existing_token
    FROM public.dashboard_team
   WHERE owner_user_id = _uid
     AND lower(member_email) = _normalized
     AND invite_token IS NOT NULL
   LIMIT 1;
  _token := COALESCE(_existing_token,
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

  SELECT id INTO _matched_user FROM auth.users WHERE lower(email) = _normalized LIMIT 1;

  FOR _bot IN
    SELECT id FROM public.bot_orders WHERE user_id = _uid AND group_id = _group_id
  LOOP
    INSERT INTO public.dashboard_team (
      owner_user_id, member_email, member_user_id, role,
      invite_token, invited_by, accepted_at, bot_id, all_bots, group_id
    ) VALUES (
      _uid, _normalized, _matched_user, _role,
      _token, _uid,
      CASE WHEN _matched_user IS NOT NULL THEN now() ELSE NULL END,
      _bot.id, false, _group_id
    )
    ON CONFLICT (bot_id, lower(member_email)) DO UPDATE
      SET role = EXCLUDED.role,
          group_id = CASE WHEN public.dashboard_team.all_bots THEN NULL ELSE EXCLUDED.group_id END,
          invite_token = COALESCE(public.dashboard_team.invite_token, EXCLUDED.invite_token),
          member_user_id = COALESCE(public.dashboard_team.member_user_id, EXCLUDED.member_user_id),
          invited_at = now()
    RETURNING id INTO _first_id;
    _bot_count := _bot_count + 1;
  END LOOP;

  -- A seat is a row on a bot, so a group with no bots has nowhere to put one.
  -- Say so plainly; the owner adds a bot to the group and invites again.
  IF _bot_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'this group has no bots yet, add a bot to it first');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', _first_id, 'invite_token', _token, 'bot_count', _bot_count);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.team_invite_member_group_v2(text, text, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.team_invite_member_group_v2(text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Permission check that honours per-group overrides
-- ---------------------------------------------------------------------------
-- The defaults the server checks against. This adds manage_settings, which the
-- dashboard and the effective-role function already use but the server copy
-- did not know about, so it always came back false here.
CREATE OR REPLACE FUNCTION public.team_default_permissions(_role text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'owner'     THEN jsonb_build_object('view_dashboard',true,'edit_bot_config',true,'manage_secrets',true,'manage_settings',true,'view_logs',true,'edit_billing',true,'manage_team',true,'transfer_ownership',true)
    WHEN 'co_owner'  THEN jsonb_build_object('view_dashboard',true,'edit_bot_config',true,'manage_secrets',true,'manage_settings',true,'view_logs',true,'edit_billing',true,'manage_team',true,'transfer_ownership',false)
    WHEN 'admin'     THEN jsonb_build_object('view_dashboard',true,'edit_bot_config',true,'manage_secrets',true,'manage_settings',true,'view_logs',true,'edit_billing',false,'manage_team',false,'transfer_ownership',false)
    WHEN 'moderator' THEN jsonb_build_object('view_dashboard',true,'edit_bot_config',true,'manage_secrets',false,'manage_settings',false,'view_logs',true,'edit_billing',false,'manage_team',false,'transfer_ownership',false)
    WHEN 'viewer'    THEN jsonb_build_object('view_dashboard',true,'edit_bot_config',false,'manage_secrets',false,'manage_settings',false,'view_logs',false,'edit_billing',false,'manage_team',false,'transfer_ownership',false)
    ELSE jsonb_build_object('view_dashboard',false,'edit_bot_config',false,'manage_secrets',false,'manage_settings',false,'view_logs',false,'edit_billing',false,'manage_team',false,'transfer_ownership',false)
  END;
$$;

-- Order of precedence: the override the owner set for the bot's own group,
-- then the account-wide override, then the role's defaults.
CREATE OR REPLACE FUNCTION public.has_bot_team_perm(_viewer_id uuid, _bot_id uuid, _perm text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
  _owner uuid;
  _bot_group uuid;
  _perms jsonb;
  _custom jsonb;
  _has_group_col boolean;
BEGIN
  IF _viewer_id IS NULL OR _bot_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT role, owner_user_id INTO _role, _owner FROM public.dashboard_team
   WHERE bot_id = _bot_id
     AND member_user_id = _viewer_id
     AND accepted_at IS NOT NULL
     AND role <> 'owner'
   LIMIT 1;
  IF _role IS NULL THEN RETURN false; END IF;

  _perms := public.team_default_permissions(_role);

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'dashboard_role_permissions' AND column_name = 'group_id'
  ) INTO _has_group_col;

  IF _has_group_col THEN
    SELECT group_id INTO _bot_group FROM public.bot_orders WHERE id = _bot_id;
    EXECUTE $q$
      SELECT permissions FROM public.dashboard_role_permissions
       WHERE owner_user_id = $1 AND role = $2
         AND (group_id = $3 OR group_id IS NULL OR group_id = '00000000-0000-0000-0000-000000000000'::uuid)
       ORDER BY (group_id = $3) DESC NULLS LAST
       LIMIT 1
    $q$ INTO _custom USING _owner, _role, _bot_group;
  ELSE
    SELECT permissions INTO _custom FROM public.dashboard_role_permissions
     WHERE owner_user_id = _owner AND role = _role
     LIMIT 1;
  END IF;

  IF _custom IS NOT NULL THEN
    _perms := _perms || _custom;
  END IF;
  RETURN COALESCE((_perms ->> _perm)::boolean, false);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. A fast roster for the owner's whole account
-- ---------------------------------------------------------------------------
-- One row per person, with the scope their seats add up to:
--   'all'      every bot (whole dashboard)
--   <group id> that group's bots
--   'some'     a hand-picked set that is neither (legacy per-bot invites)
CREATE OR REPLACE FUNCTION public.team_owner_roster()
RETURNS TABLE (
  member_email text,
  member_user_id uuid,
  role text,
  accepted boolean,
  accepted_at timestamptz,
  invited_at timestamptz,
  invite_token text,
  scope text,
  bot_count int,
  from_rule boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  mine AS (SELECT count(*)::int AS n FROM public.bot_orders bo, me WHERE bo.user_id = me.uid),
  seats AS (
    SELECT t.*, lower(t.member_email) AS em
      FROM public.dashboard_team t, me
     WHERE t.owner_user_id = me.uid AND t.role <> 'owner'
  )
  SELECT
    min(s.member_email) AS member_email,
    max(s.member_user_id::text)::uuid AS member_user_id,
    (array_agg(s.role ORDER BY s.accepted_at DESC NULLS LAST))[1] AS role,
    bool_or(s.accepted_at IS NOT NULL) AS accepted,
    max(s.accepted_at) AS accepted_at,
    min(s.invited_at) AS invited_at,
    max(s.invite_token) AS invite_token,
    CASE
      WHEN bool_or(s.all_bots) OR count(DISTINCT s.bot_id) >= (SELECT n FROM mine) THEN 'all'
      WHEN count(DISTINCT s.group_id) = 1 AND min(s.group_id::text) IS NOT NULL THEN min(s.group_id::text)
      ELSE 'some'
    END AS scope,
    count(DISTINCT s.bot_id)::int AS bot_count,
    bool_or(s.access_grant_id IS NOT NULL) AS from_rule
  FROM seats s
  GROUP BY s.em
  ORDER BY min(s.member_email);
$$;
REVOKE EXECUTE ON FUNCTION public.team_owner_roster() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.team_owner_roster() TO authenticated;

NOTIFY pgrst, 'reload schema';
