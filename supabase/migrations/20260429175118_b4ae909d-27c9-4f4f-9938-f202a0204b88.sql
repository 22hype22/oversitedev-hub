
-- ============================================================
-- bot_server_slots: paid extra-server allowance per bot
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_server_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  extra_slots INTEGER NOT NULL DEFAULT 0 CHECK (extra_slots >= 0),
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_server_slots_user ON public.bot_server_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_server_slots_sub ON public.bot_server_slots(stripe_subscription_id);

ALTER TABLE public.bot_server_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own slots" ON public.bot_server_slots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all slots" ON public.bot_server_slots
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Support view slots" ON public.bot_server_slots
  FOR SELECT TO authenticated USING (public.has_support_access(auth.uid(), user_id));
CREATE POLICY "Service role manages slots" ON public.bot_server_slots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_bot_server_slots_updated_at
  BEFORE UPDATE ON public.bot_server_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- bot_active_guilds: reported by worker on guildCreate / guildDelete
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bot_active_guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL,
  user_id UUID NOT NULL,
  guild_id TEXT NOT NULL,
  guild_name TEXT,
  member_count INTEGER,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bot_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_active_guilds_bot ON public.bot_active_guilds(bot_id);

ALTER TABLE public.bot_active_guilds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own active guilds" ON public.bot_active_guilds
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all active guilds" ON public.bot_active_guilds
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Support view active guilds" ON public.bot_active_guilds
  FOR SELECT TO authenticated USING (public.has_support_access(auth.uid(), user_id));
CREATE POLICY "Service role manages active guilds" ON public.bot_active_guilds
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- get_bot_server_limit
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_bot_server_limit(_bot_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _extra INTEGER := 0;
  _current INTEGER := 0;
  _status TEXT := 'inactive';
  _period_end TIMESTAMPTZ;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  IF _bot_owner <> _user_id
     AND NOT public.has_role(_user_id, 'admin'::app_role)
     AND NOT public.has_support_access(_user_id, _bot_owner) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT extra_slots, status, current_period_end
    INTO _extra, _status, _period_end
  FROM public.bot_server_slots WHERE bot_id = _bot_id;

  -- Treat expired/canceled subs as 0 extra
  IF _status NOT IN ('active','trialing') THEN
    _extra := 0;
  END IF;

  SELECT COUNT(*) INTO _current FROM public.bot_active_guilds WHERE bot_id = _bot_id;

  RETURN jsonb_build_object(
    'bot_id', _bot_id,
    'limit', 1 + COALESCE(_extra, 0),
    'extra_slots', COALESCE(_extra, 0),
    'current_count', _current,
    'subscription_status', _status,
    'current_period_end', _period_end
  );
END;
$$;

-- ============================================================
-- admin_set_bot_extra_slots
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_set_bot_extra_slots(_bot_id UUID, _extra_slots INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _bot_owner UUID;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only admins.');
  END IF;
  IF _extra_slots < 0 OR _extra_slots > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid slot count.');
  END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.'); END IF;

  INSERT INTO public.bot_server_slots (bot_id, user_id, extra_slots, status)
  VALUES (_bot_id, _bot_owner, _extra_slots, CASE WHEN _extra_slots > 0 THEN 'active' ELSE 'inactive' END)
  ON CONFLICT (bot_id) DO UPDATE
    SET extra_slots = EXCLUDED.extra_slots,
        status = CASE WHEN EXCLUDED.extra_slots > 0 THEN 'active' ELSE 'inactive' END,
        updated_at = now();

  PERFORM public.log_admin_action('set_bot_extra_slots', _bot_owner, _bot_id,
    jsonb_build_object('extra_slots', _extra_slots));

  RETURN jsonb_build_object('ok', true, 'extra_slots', _extra_slots);
END;
$$;

-- ============================================================
-- runtime_upsert_bot_guild  (worker: bot joined / still in a guild)
-- Returns { ok, allowed } — if not allowed the worker should leave.
-- ============================================================
CREATE OR REPLACE FUNCTION public.runtime_upsert_bot_guild(
  _bot_id UUID,
  _guild_id TEXT,
  _guild_name TEXT DEFAULT NULL,
  _member_count INTEGER DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bot_owner UUID;
  _extra INTEGER := 0;
  _status TEXT := 'inactive';
  _limit INTEGER;
  _current INTEGER;
  _exists BOOLEAN;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;

  SELECT extra_slots, status INTO _extra, _status
  FROM public.bot_server_slots WHERE bot_id = _bot_id;
  IF _status NOT IN ('active','trialing') THEN _extra := 0; END IF;
  _limit := 1 + COALESCE(_extra, 0);

  SELECT EXISTS (
    SELECT 1 FROM public.bot_active_guilds WHERE bot_id = _bot_id AND guild_id = _guild_id
  ) INTO _exists;

  IF NOT _exists THEN
    SELECT COUNT(*) INTO _current FROM public.bot_active_guilds WHERE bot_id = _bot_id;
    IF _current >= _limit THEN
      -- Over limit: do NOT record, tell worker to leave
      RETURN jsonb_build_object('ok', true, 'allowed', false, 'limit', _limit, 'current', _current);
    END IF;
  END IF;

  INSERT INTO public.bot_active_guilds (bot_id, user_id, guild_id, guild_name, member_count)
  VALUES (_bot_id, _bot_owner, _guild_id, _guild_name, _member_count)
  ON CONFLICT (bot_id, guild_id) DO UPDATE
    SET guild_name = COALESCE(EXCLUDED.guild_name, public.bot_active_guilds.guild_name),
        member_count = COALESCE(EXCLUDED.member_count, public.bot_active_guilds.member_count),
        last_seen_at = now();

  RETURN jsonb_build_object('ok', true, 'allowed', true, 'limit', _limit);
END;
$$;

-- ============================================================
-- runtime_remove_bot_guild  (worker: bot was removed / left a guild)
-- ============================================================
CREATE OR REPLACE FUNCTION public.runtime_remove_bot_guild(_bot_id UUID, _guild_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  DELETE FROM public.bot_active_guilds WHERE bot_id = _bot_id AND guild_id = _guild_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
