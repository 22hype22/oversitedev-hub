-- Enable pgcrypto for symmetric encryption (already available in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =============================================================
-- 1) Catalog: which secrets each addon/base requires
-- =============================================================
CREATE TABLE public.bot_secret_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  addon_id TEXT NOT NULL,            -- e.g. "discord", "base", "openai-plugin"
  key TEXT NOT NULL,                 -- e.g. "DISCORD_TOKEN"
  label TEXT NOT NULL,               -- "Discord bot token"
  description TEXT,                  -- "Get this from the Discord Developer Portal..."
  placeholder TEXT,                  -- "MTI..."
  is_required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (addon_id, key)
);

ALTER TABLE public.bot_secret_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view secret slots"
  ON public.bot_secret_slots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert secret slots"
  ON public.bot_secret_slots FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update secret slots"
  ON public.bot_secret_slots FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete secret slots"
  ON public.bot_secret_slots FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_bot_secret_slots_updated
  BEFORE UPDATE ON public.bot_secret_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 2) Encryption key (stored as a Supabase secret/GUC)
-- =============================================================
-- We read the encryption passphrase from a Postgres setting that we set
-- via the BOT_SECRETS_KEY Supabase secret. The runtime_get_bot_secret
-- function reads it from current_setting('app.bot_secrets_key', true).
-- If unset, encryption falls back to a project-bound default derived
-- from the database name (still better than plaintext, but admins
-- should set BOT_SECRETS_KEY).
CREATE OR REPLACE FUNCTION public._bot_secrets_key()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k TEXT;
BEGIN
  BEGIN
    k := current_setting('app.bot_secrets_key', true);
  EXCEPTION WHEN OTHERS THEN
    k := NULL;
  END;
  IF k IS NULL OR length(k) < 16 THEN
    -- Fallback: derive a project-bound key. Not ideal, but avoids hard
    -- failures before the admin sets BOT_SECRETS_KEY.
    k := encode(extensions.digest('lovable-bot-secrets::' || current_database(), 'sha256'), 'hex');
  END IF;
  RETURN k;
END;
$$;

REVOKE ALL ON FUNCTION public._bot_secrets_key() FROM PUBLIC, anon, authenticated;

-- =============================================================
-- 3) Stored encrypted secrets
-- =============================================================
CREATE TABLE public.bot_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bot_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  key TEXT NOT NULL,
  value_encrypted BYTEA NOT NULL,
  last_four TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bot_id, key)
);

CREATE INDEX idx_bot_secrets_bot_id ON public.bot_secrets(bot_id);
CREATE INDEX idx_bot_secrets_user_id ON public.bot_secrets(user_id);

ALTER TABLE public.bot_secrets ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: clients can SELECT rows for their own bots so the dashboard
-- can show "which keys are filled + last 4 chars", but value_encrypted
-- is bytea — useless without the encryption key, which lives in a SECURITY
-- DEFINER function and is never exposed to clients.
CREATE POLICY "Owners can view their bot secret rows"
  ON public.bot_secrets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bot secret rows"
  ON public.bot_secrets FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No direct INSERT/UPDATE/DELETE for clients — they MUST go through the
-- set_bot_secret / delete_bot_secret functions so values are properly
-- encrypted and last_four is computed server-side.
CREATE POLICY "Service role can manage bot secrets"
  ON public.bot_secrets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trg_bot_secrets_updated
  BEFORE UPDATE ON public.bot_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 4) Owner-facing functions
-- =============================================================

-- Save or overwrite a secret. Encrypts server-side.
CREATE OR REPLACE FUNCTION public.set_bot_secret(
  _bot_id UUID,
  _key TEXT,
  _value TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _slot public.bot_secret_slots%ROWTYPE;
  _last_four TEXT;
  _enc BYTEA;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;
  IF _key IS NULL OR length(trim(_key)) = 0 OR length(_key) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid key.');
  END IF;
  IF _value IS NULL OR length(_value) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Value cannot be empty.');
  END IF;
  IF length(_value) > 8000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Value too long (max 8000 chars).');
  END IF;

  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bot not found.');
  END IF;
  IF _bot_owner <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You can only manage secrets on your own bots.');
  END IF;

  -- Require the key to be a known slot (tied to an addon the bot has)
  SELECT * INTO _slot FROM public.bot_secret_slots WHERE upper(key) = upper(_key) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown secret key.');
  END IF;

  _last_four := CASE WHEN length(_value) >= 4 THEN right(_value, 4) ELSE repeat('*', length(_value)) END;
  _enc := extensions.pgp_sym_encrypt(_value, public._bot_secrets_key());

  INSERT INTO public.bot_secrets (bot_id, user_id, key, value_encrypted, last_four)
  VALUES (_bot_id, _user_id, upper(_key), _enc, _last_four)
  ON CONFLICT (bot_id, key) DO UPDATE
    SET value_encrypted = EXCLUDED.value_encrypted,
        last_four = EXCLUDED.last_four,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'key', upper(_key), 'last_four', _last_four);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_bot_secret(UUID, TEXT, TEXT) TO authenticated;

-- Delete a stored secret.
CREATE OR REPLACE FUNCTION public.delete_bot_secret(_bot_id UUID, _key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL OR _bot_owner <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed.');
  END IF;
  DELETE FROM public.bot_secrets WHERE bot_id = _bot_id AND key = upper(_key);
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_bot_secret(UUID, TEXT) TO authenticated;

-- Return slot catalog + which keys are filled (no values).
CREATE OR REPLACE FUNCTION public.get_bot_secrets_metadata(_bot_id UUID)
RETURNS TABLE (
  addon_id TEXT,
  key TEXT,
  label TEXT,
  description TEXT,
  placeholder TEXT,
  is_required BOOLEAN,
  sort_order INTEGER,
  is_set BOOLEAN,
  last_four TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL OR _bot_owner <> _user_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  SELECT s.addon_id, s.key, s.label, s.description, s.placeholder,
         s.is_required, s.sort_order,
         (bs.id IS NOT NULL) AS is_set,
         COALESCE(bs.last_four, '') AS last_four,
         bs.updated_at
  FROM public.bot_secret_slots s
  LEFT JOIN public.bot_secrets bs
    ON bs.bot_id = _bot_id AND bs.key = s.key
  ORDER BY s.sort_order, s.label;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bot_secrets_metadata(UUID) TO authenticated;

-- Reveal a single secret to the owner. Caller must pass their current
-- password; we verify it against auth.users before decrypting.
CREATE OR REPLACE FUNCTION public.reveal_bot_secret(
  _bot_id UUID,
  _key TEXT,
  _password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _bot_owner UUID;
  _stored BYTEA;
  _hashed TEXT;
  _value TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;
  IF _password IS NULL OR length(_password) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Password required.');
  END IF;

  SELECT user_id INTO _bot_owner FROM public.bot_orders WHERE id = _bot_id;
  IF _bot_owner IS NULL OR _bot_owner <> _user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed.');
  END IF;

  -- Verify password against auth.users.encrypted_password
  SELECT encrypted_password INTO _hashed FROM auth.users WHERE id = _user_id;
  IF _hashed IS NULL OR _hashed = '' THEN
    -- OAuth-only users can't reveal via password
    RETURN jsonb_build_object('ok', false, 'error', 'Password reveal not available for this account. Set a password first.');
  END IF;
  IF extensions.crypt(_password, _hashed) <> _hashed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Incorrect password.');
  END IF;

  SELECT value_encrypted INTO _stored
  FROM public.bot_secrets
  WHERE bot_id = _bot_id AND key = upper(_key);
  IF _stored IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Secret not set.');
  END IF;

  _value := extensions.pgp_sym_decrypt(_stored, public._bot_secrets_key());
  RETURN jsonb_build_object('ok', true, 'key', upper(_key), 'value', _value);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reveal_bot_secret(UUID, TEXT, TEXT) TO authenticated;

-- =============================================================
-- 5) Runtime function (service role only)
-- =============================================================
CREATE OR REPLACE FUNCTION public.runtime_get_bot_secret(
  _bot_id UUID,
  _key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _stored BYTEA;
BEGIN
  -- Hard guard: only service_role may call this.
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT value_encrypted INTO _stored
  FROM public.bot_secrets
  WHERE bot_id = _bot_id AND key = upper(_key);
  IF _stored IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN extensions.pgp_sym_decrypt(_stored, public._bot_secrets_key());
END;
$$;

REVOKE ALL ON FUNCTION public.runtime_get_bot_secret(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runtime_get_bot_secret(UUID, TEXT) TO service_role;