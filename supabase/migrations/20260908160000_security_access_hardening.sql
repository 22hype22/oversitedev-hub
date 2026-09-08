-- Security hardening, part 2: who may change what.
--
-- Closes, from an authorized review of the live project:
--   1. A signed-in user could insert a dashboard_team row naming any bot and
--      themselves as an accepted co-owner, and the team gate functions never
--      checked that the row's owner really owns the bot. That opened the bot's
--      orders, secrets metadata, config, and commands to the attacker.
--   2. A signed-in user could set their own order to paid or ready straight
--      through PostgREST, which assigns a pooled Discord token and deploys a
--      bot without any payment, and could insert an order with any total.
--   3. The bot-facing tables for verification, tickets, XP, protection logs,
--      and post_message claiming were open to every bot at once (and to
--      anyone holding the public key).
--   4. runtime_get_bot_secret accepted an unbound worker token for any bot.
--   5. Captcha answers were public; free hosting codes were listable; a user
--      could un-ban themselves; discount codes could be probed anonymously.
--   6. The deploy and cancel triggers called their edge functions with only
--      the public key, which forced those functions to accept anyone.

-- ---------------------------------------------------------------------------
-- 1. Team seats must sit on a bot the row's owner actually owns.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owner manages own team" ON public.dashboard_team;
CREATE POLICY "Owner manages own team"
  ON public.dashboard_team FOR ALL TO authenticated
  USING (
    auth.uid() = owner_user_id
    AND (bot_id IS NULL OR EXISTS (
      SELECT 1 FROM public.bot_orders o WHERE o.id = dashboard_team.bot_id AND o.user_id = auth.uid()
    ))
  )
  WITH CHECK (
    auth.uid() = owner_user_id
    AND (bot_id IS NULL OR EXISTS (
      SELECT 1 FROM public.bot_orders o WHERE o.id = dashboard_team.bot_id AND o.user_id = auth.uid()
    ))
  );

-- Seats only count when the row's owner is the bot's real owner.
CREATE OR REPLACE FUNCTION public.has_bot_team_access(_viewer_id uuid, _bot_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dashboard_team t
    JOIN public.bot_orders o ON o.id = t.bot_id AND o.user_id = t.owner_user_id
    WHERE t.bot_id = _bot_id
      AND t.member_user_id = _viewer_id
      AND t.accepted_at IS NOT NULL
      AND t.role <> 'owner'
  );
$$;

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

  -- Platform staff (admin/support) keep full access for support work.
  IF to_regprocedure('public.is_platform_staff(uuid)') IS NOT NULL
     AND public.is_platform_staff(_viewer_id) THEN
    RETURN true;
  END IF;

  SELECT t.role, t.owner_user_id INTO _role, _owner
  FROM public.dashboard_team t
  JOIN public.bot_orders o ON o.id = t.bot_id AND o.user_id = t.owner_user_id
  WHERE t.bot_id = _bot_id
    AND t.member_user_id = _viewer_id
    AND t.accepted_at IS NOT NULL
    AND t.role <> 'owner'
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
-- 2. Orders: clients cannot touch money, status, or deployment columns.
-- ---------------------------------------------------------------------------

-- Is this statement running for a browser or bot session (not the service
-- role, not a direct database session)?
CREATE OR REPLACE FUNCTION public.is_client_session()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(current_setting('request.jwt.claim.role', true), '') IN ('anon', 'authenticated');
$$;

CREATE OR REPLACE FUNCTION public.is_roblox_base(_base text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _base IS NOT NULL
     AND array_length(regexp_split_to_array(_base, '[^a-z0-9-]+'), 1) > 0
     AND NOT EXISTS (
       SELECT 1 FROM unnest(regexp_split_to_array(_base, '[^a-z0-9-]+')) AS p(part)
       WHERE part <> '' AND part NOT IN ('dispatch', 'erlc-spec', 'customs', 'roleplay')
     );
$$;

-- The lowest total the catalog allows for a base string, in USD, after the
-- owner's price overrides (list price minus the gear's discount) and the
-- two-bot rule (every Discord bot after the first is 50, or its own price if
-- lower). Add-ons are not part of the order total.
CREATE OR REPLACE FUNCTION public.order_base_floor(_base text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _pricing jsonb;
  _part text;
  _list numeric;
  _price numeric;
  _discord numeric := 0;
  _roblox numeric := 0;
  _n_discord int := 0;
  _has_scratch boolean := false;
  _catalog jsonb := '{"protection":99,"support":99,"utilities":99,"scratch":199,"dispatch":19.99,"customs":99,"roleplay":99,"erlc-spec":99}'::jsonb;
BEGIN
  SELECT coalesce(bot_pricing, '{}'::jsonb) INTO _pricing FROM public.app_settings WHERE id = 1;
  IF _pricing IS NULL THEN _pricing := '{}'::jsonb; END IF;

  FOR _part IN SELECT p FROM unnest(regexp_split_to_array(coalesce(_base, ''), '[^a-z0-9-]+')) AS t(p) WHERE p <> ''
  LOOP
    _list := coalesce((_pricing -> _part ->> 'price')::numeric, (_catalog ->> _part)::numeric, 99);
    _price := greatest(0, _list - coalesce((_pricing -> _part ->> 'discount')::numeric, 0));
    IF _part IN ('dispatch', 'erlc-spec', 'customs', 'roleplay') THEN
      _roblox := _roblox + _price;
    ELSIF _part = 'scratch' THEN
      _has_scratch := true;
      _discord := _price;
    ELSE
      IF NOT _has_scratch THEN
        _n_discord := _n_discord + 1;
        _discord := _discord + CASE WHEN _n_discord = 1 THEN _price ELSE least(_price, 50) END;
      END IF;
    END IF;
  END LOOP;
  RETURN round(_discord + _roblox, 2);
END;
$$;

-- The discount a live code is allowed to take off a total.
CREATE OR REPLACE FUNCTION public.order_discount_allowed(_code text, _total numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT CASE WHEN d.kind = 'percent' THEN round(_total * d.value / 100, 2) ELSE d.value END
    FROM public.discount_codes d
    WHERE _code IS NOT NULL
      AND lower(d.code) = lower(_code)
      AND d.is_active = true
      AND (d.expires_at IS NULL OR d.expires_at > now())
      AND (d.max_uses IS NULL OR d.times_used < d.max_uses)
    LIMIT 1
  ), 0);
$$;

CREATE OR REPLACE FUNCTION public.bot_orders_guard_client_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _floor numeric;
  _allowed numeric;
BEGIN
  -- Service role, direct database sessions, and admins are trusted.
  IF NOT public.is_client_session() THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A new order always starts unpaid and undeployed.
    NEW.status := 'pending_payment';
    NEW.paid_at := NULL;
    NEW.charged_at := NULL;
    NEW.build_started := NULL;
    NEW.bot_token := NULL;
    NEW.railway_service_id := NULL;
    NEW.deployment_status := NULL;
    NEW.deployment_error := NULL;
    NEW.deployment_attempted_at := NULL;
    NEW.purchase_id := NULL;
    NEW.subscription_id := NULL;
    NEW.stripe_customer_id := NULL;
    NEW.stripe_payment_intent_id := NULL;
    NEW.stripe_payment_method_id := NULL;
    NEW.stripe_session_id := NULL;
    NEW.stripe_setup_intent_id := NULL;
    NEW.delivery_url := NULL;
    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'order_user_mismatch';
    END IF;
    -- Hosting is billed for Discord bots only; a comped account never pays it.
    NEW.monthly_hosting := NOT public.is_roblox_base(NEW.base)
      AND NOT coalesce(public.is_comped_email(), false);
    -- Child rows of a pack carry no money of their own.
    IF NEW.parent_order_id IS NOT NULL THEN
      NEW.total_amount := 0;
      NEW.discount_amount := 0;
      NEW.discount_code := NULL;
    ELSE
      _floor := public.order_base_floor(NEW.base);
      _allowed := least(_floor, public.order_discount_allowed(NEW.discount_code, _floor));
      IF coalesce(NEW.discount_amount, 0) > _allowed + 0.01 THEN
        RAISE EXCEPTION 'order_discount_too_large';
      END IF;
      IF coalesce(NEW.total_amount, 0) < _floor - coalesce(NEW.discount_amount, 0) - 0.01 THEN
        RAISE EXCEPTION 'order_total_below_catalog';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: money, lifecycle, and deployment columns are frozen for clients.
  -- The one client-driven transition is cancelling.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'order_status_locked';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.parent_order_id IS DISTINCT FROM OLD.parent_order_id
     OR NEW.base IS DISTINCT FROM OLD.base
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.discount_code IS DISTINCT FROM OLD.discount_code
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.monthly_hosting IS DISTINCT FROM OLD.monthly_hosting
     OR NEW.payment_plan IS DISTINCT FROM OLD.payment_plan
     OR NEW.plan_months IS DISTINCT FROM OLD.plan_months
     OR NEW.installment_amount IS DISTINCT FROM OLD.installment_amount
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.charged_at IS DISTINCT FROM OLD.charged_at
     OR NEW.build_started IS DISTINCT FROM OLD.build_started
     OR NEW.purchase_id IS DISTINCT FROM OLD.purchase_id
     OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
     OR NEW.stripe_payment_method_id IS DISTINCT FROM OLD.stripe_payment_method_id
     OR NEW.stripe_session_id IS DISTINCT FROM OLD.stripe_session_id
     OR NEW.stripe_setup_intent_id IS DISTINCT FROM OLD.stripe_setup_intent_id
     OR NEW.bot_token IS DISTINCT FROM OLD.bot_token
     OR NEW.railway_service_id IS DISTINCT FROM OLD.railway_service_id
     OR NEW.deployment_status IS DISTINCT FROM OLD.deployment_status
     OR NEW.deployment_error IS DISTINCT FROM OLD.deployment_error
     OR NEW.deployment_attempted_at IS DISTINCT FROM OLD.deployment_attempted_at
     OR NEW.delivery_url IS DISTINCT FROM OLD.delivery_url
  THEN
    RAISE EXCEPTION 'order_column_locked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_orders_guard_client_writes ON public.bot_orders;
CREATE TRIGGER bot_orders_guard_client_writes
  BEFORE INSERT OR UPDATE ON public.bot_orders
  FOR EACH ROW EXECUTE FUNCTION public.bot_orders_guard_client_writes();

-- ---------------------------------------------------------------------------
-- 3. Bot-facing tables: a bot sees and writes only its own rows.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['verification_tokens','verification_queue','verification_attempts','tickets','user_xp','banned_members_backup','nuke_actions','protection_events','flagged_entities']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND 'anon' = ANY (roles)
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
    IF t = 'flagged_entities' THEN
      -- Shared blocklist: readable by any real bot, never written by one.
      EXECUTE format('CREATE POLICY "Worker reads %s" ON public.%I FOR SELECT TO anon USING (public.worker_bot_id() IS NOT NULL)', t, t);
    ELSE
      EXECUTE format('CREATE POLICY "Worker reads own %s" ON public.%I FOR SELECT TO anon USING (bot_id = public.worker_bot_id())', t, t);
      EXECUTE format('CREATE POLICY "Worker inserts own %s" ON public.%I FOR INSERT TO anon WITH CHECK (bot_id = public.worker_bot_id())', t, t);
      EXECUTE format('CREATE POLICY "Worker updates own %s" ON public.%I FOR UPDATE TO anon USING (bot_id = public.worker_bot_id()) WITH CHECK (bot_id = public.worker_bot_id())', t, t);
    END IF;
  END LOOP;
END $$;

-- post_message claiming: only for the bot named by the request's worker token.
CREATE OR REPLACE FUNCTION public.claim_post_message(_worker_id text DEFAULT NULL::text, _bot_id uuid DEFAULT NULL::uuid)
RETURNS SETOF public.bot_commands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  claimed public.bot_commands%ROWTYPE;
  _me uuid;
BEGIN
  IF public.is_client_session() THEN
    _me := public.worker_bot_id();
    IF _me IS NULL OR _bot_id IS NULL OR _bot_id <> _me THEN
      RAISE EXCEPTION 'token_bot_mismatch';
    END IF;
  END IF;
  UPDATE public.bot_commands
  SET status = 'claimed',
      worker_id = COALESCE(NULLIF(_worker_id, ''), 'discord-bot'),
      claimed_at = now(),
      updated_at = now()
  WHERE id = (
    SELECT id FROM public.bot_commands
    WHERE action = 'post_message' AND status = 'pending' AND (_bot_id IS NULL OR bot_id = _bot_id)
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO claimed;
  IF claimed.id IS NOT NULL THEN
    RETURN NEXT claimed;
  END IF;
  RETURN;
END;
$function$;

DO $$
BEGIN
  IF to_regprocedure('public.complete_post_message(uuid, text, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.complete_post_message(uuid, text, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.complete_post_message(uuid, text, text) TO service_role;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Bot secrets: the token must be bound to exactly this bot.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.runtime_get_bot_secret(_token text, _bot_id uuid, _key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _tok record;
  _stored bytea;
BEGIN
  SELECT * INTO _tok FROM public._worker_token_lookup(_token) LIMIT 1;
  IF _tok.token_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF _tok.bot_id IS NULL OR _tok.bot_id <> _bot_id THEN
    RAISE EXCEPTION 'token_bot_mismatch';
  END IF;
  SELECT value_encrypted INTO _stored
  FROM public.bot_secrets
  WHERE bot_id = _bot_id AND key = upper(_key)
  LIMIT 1;
  IF _stored IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN extensions.pgp_sym_decrypt(_stored, public._bot_secrets_key());
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Smaller holes.
-- ---------------------------------------------------------------------------
-- Captcha answers are not public. Admins manage the pool; a real bot may read.
DO $$
DECLARE p record;
BEGIN
  IF to_regclass('public.captcha_images') IS NOT NULL THEN
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'captcha_images'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.captcha_images', p.policyname);
    END LOOP;
    CREATE POLICY "Admins manage captcha images" ON public.captcha_images FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
    CREATE POLICY "Worker reads captcha images" ON public.captcha_images FOR SELECT TO anon
      USING (public.worker_bot_id() IS NOT NULL);
  END IF;
END $$;

-- Free hosting codes cannot be listed; redemption goes through its RPC.
DROP POLICY IF EXISTS "Users can read active codes for redemption" ON public.bot_free_period_codes;

-- A user cannot change their own ban flag.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND welcome_discount_available = (SELECT p.welcome_discount_available FROM public.profiles p WHERE p.user_id = auth.uid())
    AND is_banned = (SELECT p.is_banned FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- Discount codes are checked by signed-in customers only.
REVOKE EXECUTE ON FUNCTION public.validate_discount_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Deploy and cancel triggers carry a real secret.
-- ---------------------------------------------------------------------------
ALTER TABLE public.deploy_config ADD COLUMN IF NOT EXISTS internal_secret text;
UPDATE public.deploy_config
SET internal_secret = encode(extensions.gen_random_bytes(32), 'hex')
WHERE id = 1 AND (internal_secret IS NULL OR internal_secret = '');

CREATE OR REPLACE FUNCTION public.trigger_auto_deploy_bot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  cfg record;
  _is_transition boolean;
BEGIN
  _is_transition := NEW.status = 'ready'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ready');
  IF NOT _is_transition THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.deployment_status = 'deploying' AND NEW.deployment_status = 'deploying' THEN
    RETURN NEW;
  END IF;
  SELECT fn_url, anon_key, internal_secret INTO cfg FROM public.deploy_config WHERE id = 1;
  IF cfg.fn_url IS NULL OR cfg.anon_key IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'ready' THEN
    NEW.railway_service_id := NULL;
    NEW.bot_token := NULL;
    NEW.deployment_error := NULL;
  END IF;
  PERFORM net.http_post(
    url := cfg.fn_url || '/auto-deploy-bot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cfg.anon_key,
      'x-internal-secret', coalesce(cfg.internal_secret, '')
    ),
    body := jsonb_build_object('orderId', NEW.id, 'source', 'trigger')
  );
  NEW.deployment_status := 'deploying';
  NEW.deployment_attempted_at := now();
  NEW.deployment_error := NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_release_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg record;
BEGIN
  IF NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  SELECT fn_url, anon_key, internal_secret INTO cfg FROM public.deploy_config WHERE id = 1;
  IF cfg.fn_url IS NOT NULL AND cfg.anon_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := cfg.fn_url || '/cancel-bot-deploy',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || cfg.anon_key,
        'x-internal-secret', coalesce(cfg.internal_secret, '')
      ),
      body := jsonb_build_object('orderId', NEW.id, 'source', 'trigger')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. A small rate limiter for the public edge functions (service role only).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0
);
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edge_rate_limits FROM PUBLIC, anon, authenticated;

-- True when the caller may proceed; counts the hit either way.
CREATE OR REPLACE FUNCTION public.edge_rate_limit(_key text, _limit integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hits integer;
BEGIN
  INSERT INTO public.edge_rate_limits (key, window_start, hits)
  VALUES (_key, now(), 1)
  ON CONFLICT (key) DO UPDATE
    SET hits = CASE WHEN public.edge_rate_limits.window_start < now() - make_interval(secs => _window_seconds)
                    THEN 1 ELSE public.edge_rate_limits.hits + 1 END,
        window_start = CASE WHEN public.edge_rate_limits.window_start < now() - make_interval(secs => _window_seconds)
                            THEN now() ELSE public.edge_rate_limits.window_start END
  RETURNING hits INTO _hits;
  -- Keep the table small.
  IF random() < 0.01 THEN
    DELETE FROM public.edge_rate_limits WHERE window_start < now() - interval '1 day';
  END IF;
  RETURN _hits <= _limit;
END;
$$;
REVOKE ALL ON FUNCTION public.edge_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edge_rate_limit(text, integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
