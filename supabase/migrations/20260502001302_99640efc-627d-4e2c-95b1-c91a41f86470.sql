-- 1) Add managed flag to bot_secrets
ALTER TABLE public.bot_secrets
  ADD COLUMN IF NOT EXISTS managed BOOLEAN NOT NULL DEFAULT false;

-- 2) Core assignment function
CREATE OR REPLACE FUNCTION public.assign_pool_token_to_bot(_bot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _bot_owner UUID;
  _pool_row public.bot_token_pool%ROWTYPE;
  _token_plain TEXT;
  _token_enc BYTEA;
  _client_enc BYTEA;
  _last_four_token TEXT;
  _last_four_client TEXT;
  _existing_token_managed BOOLEAN;
BEGIN
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bot not found');
  END IF;

  SELECT managed INTO _existing_token_managed
  FROM public.bot_secrets
  WHERE bot_id = _bot_id AND key = 'DISCORD_TOKEN'
  LIMIT 1;

  IF _existing_token_managed IS TRUE THEN
    RETURN jsonb_build_object('ok', true, 'already_assigned', true);
  END IF;
  IF _existing_token_managed IS FALSE THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'owner_provided');
  END IF;

  SELECT * INTO _pool_row
  FROM public.bot_token_pool
  WHERE status = 'available'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _pool_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pool_empty');
  END IF;

  _token_plain := extensions.pgp_sym_decrypt(_pool_row.token_encrypted, public._bot_secrets_key());
  _token_enc := extensions.pgp_sym_encrypt(_token_plain, public._bot_secrets_key());
  _client_enc := extensions.pgp_sym_encrypt(_pool_row.client_id, public._bot_secrets_key());

  _last_four_token := CASE WHEN length(_token_plain) >= 4 THEN right(_token_plain, 4) ELSE repeat('*', length(_token_plain)) END;
  _last_four_client := CASE WHEN length(_pool_row.client_id) >= 4 THEN right(_pool_row.client_id, 4) ELSE repeat('*', length(_pool_row.client_id)) END;

  INSERT INTO public.bot_secrets (bot_id, user_id, key, value_encrypted, last_four, managed)
  VALUES (_bot_id, _bot_owner, 'DISCORD_TOKEN', _token_enc, _last_four_token, true)
  ON CONFLICT (bot_id, key) DO UPDATE
    SET value_encrypted = EXCLUDED.value_encrypted,
        last_four = EXCLUDED.last_four,
        managed = true,
        updated_at = now();

  INSERT INTO public.bot_secrets (bot_id, user_id, key, value_encrypted, last_four, managed)
  VALUES (_bot_id, _bot_owner, 'DISCORD_CLIENT_ID', _client_enc, _last_four_client, true)
  ON CONFLICT (bot_id, key) DO UPDATE
    SET value_encrypted = EXCLUDED.value_encrypted,
        last_four = EXCLUDED.last_four,
        managed = true,
        updated_at = now();

  UPDATE public.bot_token_pool
  SET status = 'assigned',
      assigned_at = now(),
      assigned_bot_id = _bot_id,
      updated_at = now()
  WHERE id = _pool_row.id;

  RETURN jsonb_build_object('ok', true, 'pool_id', _pool_row.id, 'bot_username', _pool_row.bot_username);
END;
$$;

-- 3) Tighten set_bot_secret
CREATE OR REPLACE FUNCTION public.set_bot_secret(
  _bot_id UUID, _key TEXT, _value TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _slot public.bot_secret_slots%ROWTYPE;
  _last_four TEXT;
  _enc BYTEA;
  _is_support BOOLEAN := false;
  _is_admin BOOLEAN := false;
  _existing_managed BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.'); END IF;
  IF _key IS NULL OR length(trim(_key)) = 0 OR length(_key) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid key.');
  END IF;
  IF _value IS NULL OR length(_value) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Value cannot be empty.');
  END IF;
  IF length(_value) > 8000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Value too long.');
  END IF;

  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.'); END IF;

  _is_admin := public.has_role(_user_id, 'admin'::app_role);
  IF _bot_owner <> _user_id AND NOT _is_admin THEN
    IF public.has_support_access(_user_id, _bot_owner) THEN
      _is_support := true;
    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'Not allowed.');
    END IF;
  END IF;

  SELECT * INTO _slot FROM public.bot_secret_slots WHERE upper(key) = upper(_key) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Unknown secret key.'); END IF;

  SELECT managed INTO _existing_managed
  FROM public.bot_secrets WHERE bot_id = _bot_id AND key = upper(_key);

  IF _existing_managed IS TRUE AND _bot_owner = _user_id AND NOT _is_admin AND NOT _is_support THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This secret is managed by Oversite and cannot be edited.');
  END IF;

  _last_four := CASE WHEN length(_value) >= 4 THEN right(_value, 4) ELSE repeat('*', length(_value)) END;
  _enc := extensions.pgp_sym_encrypt(_value, public._bot_secrets_key());

  INSERT INTO public.bot_secrets (bot_id, user_id, key, value_encrypted, last_four, managed)
  VALUES (_bot_id, _bot_owner, upper(_key), _enc, _last_four, COALESCE(_existing_managed, false))
  ON CONFLICT (bot_id, key) DO UPDATE
    SET value_encrypted = EXCLUDED.value_encrypted,
        last_four = EXCLUDED.last_four,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'key', upper(_key), 'last_four', _last_four, 'via_support', _is_support);
END;
$$;

-- 4) Tighten delete_bot_secret
CREATE OR REPLACE FUNCTION public.delete_bot_secret(_bot_id UUID, _key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _is_admin BOOLEAN := false;
  _is_support BOOLEAN := false;
  _existing_managed BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.'); END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.'); END IF;

  _is_admin := public.has_role(_user_id, 'admin'::app_role);
  IF _bot_owner <> _user_id AND NOT _is_admin THEN
    IF public.has_support_access(_user_id, _bot_owner) THEN
      _is_support := true;
    ELSE
      RETURN jsonb_build_object('ok', false, 'error', 'Not allowed.');
    END IF;
  END IF;

  SELECT managed INTO _existing_managed
  FROM public.bot_secrets WHERE bot_id = _bot_id AND key = upper(_key);

  IF _existing_managed IS TRUE AND _bot_owner = _user_id AND NOT _is_admin AND NOT _is_support THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This secret is managed by Oversite and cannot be removed.');
  END IF;

  DELETE FROM public.bot_secrets WHERE bot_id = _bot_id AND key = upper(_key);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5) Add is_managed to metadata (drop+recreate due to return type change)
DROP FUNCTION IF EXISTS public.get_bot_secrets_metadata(UUID);

CREATE OR REPLACE FUNCTION public.get_bot_secrets_metadata(_bot_id UUID)
RETURNS TABLE (
  addon_id TEXT, key TEXT, label TEXT, description TEXT, placeholder TEXT,
  is_required BOOLEAN, sort_order INTEGER, is_set BOOLEAN, last_four TEXT,
  updated_at TIMESTAMPTZ, is_managed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN RAISE EXCEPTION 'Bot not found'; END IF;
  IF _bot_owner <> _user_id
     AND NOT public.has_support_access(_user_id, _bot_owner)
     AND NOT public.has_role(_user_id, 'admin'::app_role)
  THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
  SELECT s.addon_id, s.key, s.label, s.description, s.placeholder,
         s.is_required, s.sort_order, (bs.id IS NOT NULL),
         COALESCE(bs.last_four, ''), bs.updated_at,
         COALESCE(bs.managed, false)
  FROM public.bot_secret_slots s
  LEFT JOIN public.bot_secrets bs ON bs.bot_id = _bot_id AND bs.key = s.key
  ORDER BY s.sort_order, s.label;
END;
$$;

-- 6) Trigger when bot_orders.status -> paid
CREATE OR REPLACE FUNCTION public.trg_bot_order_paid_assign_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND COALESCE(OLD.status, '') <> 'paid' THEN
    BEGIN
      PERFORM public.assign_pool_token_to_bot(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'assign_pool_token_to_bot failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_orders_paid_assign_token ON public.bot_orders;
CREATE TRIGGER bot_orders_paid_assign_token
  AFTER UPDATE OF status ON public.bot_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bot_order_paid_assign_token();

-- 7) Backfill existing paid orders without a token
DO $$
DECLARE
  _row RECORD;
  _result JSONB;
BEGIN
  FOR _row IN
    SELECT bo.id
    FROM public.bot_orders bo
    LEFT JOIN public.bot_secrets bs
      ON bs.bot_id = bo.id AND bs.key = 'DISCORD_TOKEN'
    WHERE bo.status = 'paid'
      AND bs.id IS NULL
      AND bo.total_amount > 0
    ORDER BY bo.paid_at ASC
  LOOP
    SELECT public.assign_pool_token_to_bot(_row.id) INTO _result;
    EXIT WHEN (_result->>'error') = 'pool_empty';
  END LOOP;
END $$;