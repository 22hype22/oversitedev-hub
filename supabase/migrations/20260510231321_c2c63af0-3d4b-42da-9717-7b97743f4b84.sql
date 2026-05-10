
-- 1. New user-level slot table
CREATE TABLE IF NOT EXISTS public.user_extra_server_slots (
  user_id UUID PRIMARY KEY,
  extra_slots INTEGER NOT NULL DEFAULT 0 CHECK (extra_slots >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_extra_server_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own extra slots" ON public.user_extra_server_slots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all extra slots" ON public.user_extra_server_slots
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages extra slots" ON public.user_extra_server_slots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Audit table for one-time purchases
CREATE TABLE IF NOT EXISTS public.user_slot_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  amount_cents INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_slot_purchases_user ON public.user_slot_purchases(user_id);

ALTER TABLE public.user_slot_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own slot purchases" ON public.user_slot_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all slot purchases" ON public.user_slot_purchases
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages slot purchases" ON public.user_slot_purchases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Backfill from any existing per-bot active subscriptions (take max per user)
INSERT INTO public.user_extra_server_slots (user_id, extra_slots)
SELECT user_id, MAX(extra_slots)
FROM public.bot_server_slots
WHERE status IN ('active','trialing') AND extra_slots > 0
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE
  SET extra_slots = GREATEST(public.user_extra_server_slots.extra_slots, EXCLUDED.extra_slots),
      updated_at = now();

-- 4. Replace get_bot_server_limit: admin = unlimited, else 1 + user-level extra
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
  _is_admin BOOLEAN := false;
  _limit INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  IF _bot_owner <> _user_id
     AND NOT public.has_role(_user_id, 'admin'::app_role)
     AND NOT public.has_support_access(_user_id, _bot_owner) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  _is_admin := public.has_role(_bot_owner, 'admin'::app_role);

  SELECT extra_slots INTO _extra
  FROM public.user_extra_server_slots WHERE user_id = _bot_owner;
  _extra := COALESCE(_extra, 0);

  SELECT COUNT(*) INTO _current FROM public.bot_active_guilds WHERE bot_id = _bot_id;

  IF _is_admin THEN
    _limit := 999999;
  ELSE
    _limit := 1 + _extra;
  END IF;

  RETURN jsonb_build_object(
    'bot_id', _bot_id,
    'limit', _limit,
    'extra_slots', _extra,
    'current_count', _current,
    'is_unlimited', _is_admin
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_bot_server_limit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bot_server_limit(uuid) TO authenticated;

-- 5. Replace runtime_upsert_bot_guild similarly
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
  _is_admin BOOLEAN := false;
  _limit INTEGER;
  _current INTEGER;
  _exists BOOLEAN;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;

  _is_admin := public.has_role(_bot_owner, 'admin'::app_role);

  SELECT extra_slots INTO _extra
  FROM public.user_extra_server_slots WHERE user_id = _bot_owner;
  _extra := COALESCE(_extra, 0);

  IF _is_admin THEN
    _limit := 999999;
  ELSE
    _limit := 1 + _extra;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.bot_active_guilds WHERE bot_id = _bot_id AND guild_id = _guild_id
  ) INTO _exists;

  IF NOT _exists THEN
    SELECT COUNT(*) INTO _current FROM public.bot_active_guilds WHERE bot_id = _bot_id;
    IF _current >= _limit THEN
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

-- 6. Admin: set extra slots at user level
CREATE OR REPLACE FUNCTION public.admin_set_user_extra_slots(_user_id UUID, _extra_slots INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only admins.');
  END IF;
  IF _extra_slots < 0 OR _extra_slots > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid slot count.');
  END IF;

  INSERT INTO public.user_extra_server_slots (user_id, extra_slots)
  VALUES (_user_id, _extra_slots)
  ON CONFLICT (user_id) DO UPDATE
    SET extra_slots = EXCLUDED.extra_slots, updated_at = now();

  PERFORM public.log_admin_action('set_user_extra_slots', _user_id, NULL,
    jsonb_build_object('extra_slots', _extra_slots));

  RETURN jsonb_build_object('ok', true, 'extra_slots', _extra_slots);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_extra_slots(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_extra_slots(uuid, integer) TO authenticated;

-- 7. Webhook handler: increment user's slots after a confirmed purchase
CREATE OR REPLACE FUNCTION public.record_user_slot_purchase(
  _user_id UUID,
  _quantity INTEGER,
  _amount_cents INTEGER,
  _stripe_session_id TEXT,
  _stripe_payment_intent_id TEXT DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing UUID;
  _new_total INTEGER;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _quantity < 1 OR _quantity > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid quantity');
  END IF;

  -- Idempotency: skip if this session was already recorded
  SELECT id INTO _existing FROM public.user_slot_purchases
   WHERE stripe_session_id = _stripe_session_id;
  IF _existing IS NOT NULL THEN
    SELECT extra_slots INTO _new_total
      FROM public.user_extra_server_slots WHERE user_id = _user_id;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'extra_slots', COALESCE(_new_total, 0));
  END IF;

  INSERT INTO public.user_slot_purchases
    (user_id, quantity, amount_cents, stripe_session_id, stripe_payment_intent_id)
  VALUES
    (_user_id, _quantity, _amount_cents, _stripe_session_id, _stripe_payment_intent_id);

  INSERT INTO public.user_extra_server_slots (user_id, extra_slots)
  VALUES (_user_id, _quantity)
  ON CONFLICT (user_id) DO UPDATE
    SET extra_slots = public.user_extra_server_slots.extra_slots + EXCLUDED.extra_slots,
        updated_at = now()
  RETURNING extra_slots INTO _new_total;

  RETURN jsonb_build_object('ok', true, 'extra_slots', _new_total);
END;
$$;
