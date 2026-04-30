
-- Token pool table
CREATE TABLE public.bot_token_pool (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_username TEXT NOT NULL,
  client_id TEXT NOT NULL,
  token_encrypted BYTEA NOT NULL,
  token_last_four TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  notes TEXT,
  assigned_bot_id UUID REFERENCES public.bot_orders(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bot_token_pool_status_check CHECK (status IN ('available','assigned','retired')),
  CONSTRAINT bot_token_pool_client_id_unique UNIQUE (client_id)
);

CREATE INDEX idx_bot_token_pool_status ON public.bot_token_pool(status);
CREATE INDEX idx_bot_token_pool_assigned_bot ON public.bot_token_pool(assigned_bot_id);

ALTER TABLE public.bot_token_pool ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can view token pool"
  ON public.bot_token_pool FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert token pool"
  ON public.bot_token_pool FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update token pool"
  ON public.bot_token_pool FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete token pool"
  ON public.bot_token_pool FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_bot_token_pool_updated_at
  BEFORE UPDATE ON public.bot_token_pool
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: add token to pool
CREATE OR REPLACE FUNCTION public.add_bot_token_to_pool(
  _bot_username TEXT,
  _client_id TEXT,
  _token TEXT,
  _notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _admin UUID := auth.uid();
  _last_four TEXT;
  _enc BYTEA;
  _id UUID;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only admins can add tokens to the pool.');
  END IF;
  IF _bot_username IS NULL OR length(trim(_bot_username)) = 0 OR length(_bot_username) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Provide a valid bot username.');
  END IF;
  IF _client_id IS NULL OR length(trim(_client_id)) = 0 OR length(_client_id) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Provide a valid client ID.');
  END IF;
  IF _token IS NULL OR length(_token) < 20 OR length(_token) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Provide a valid bot token.');
  END IF;
  IF _notes IS NOT NULL AND length(_notes) > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Notes too long.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.bot_token_pool WHERE client_id = trim(_client_id)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A token with that client ID already exists in the pool.');
  END IF;

  _last_four := right(_token, 4);
  _enc := extensions.pgp_sym_encrypt(_token, public._bot_secrets_key());

  INSERT INTO public.bot_token_pool (bot_username, client_id, token_encrypted, token_last_four, notes, created_by)
  VALUES (trim(_bot_username), trim(_client_id), _enc, _last_four, _notes, _admin)
  RETURNING id INTO _id;

  PERFORM public.log_admin_action('add_bot_token_to_pool', NULL, NULL,
    jsonb_build_object('pool_id', _id, 'bot_username', _bot_username, 'client_id', _client_id));

  RETURN jsonb_build_object('ok', true, 'id', _id);
END;
$$;

-- RPC: update pool entry (metadata + status)
CREATE OR REPLACE FUNCTION public.update_bot_token_pool_entry(
  _id UUID,
  _bot_username TEXT DEFAULT NULL,
  _status TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL,
  _assigned_bot_id UUID DEFAULT NULL
)
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
  IF _status IS NOT NULL AND _status NOT IN ('available','assigned','retired') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid status.');
  END IF;

  UPDATE public.bot_token_pool
     SET bot_username = COALESCE(_bot_username, bot_username),
         status = COALESCE(_status, status),
         notes = COALESCE(_notes, notes),
         assigned_bot_id = CASE
           WHEN _assigned_bot_id IS NOT NULL THEN _assigned_bot_id
           WHEN _status = 'available' OR _status = 'retired' THEN NULL
           ELSE assigned_bot_id
         END,
         assigned_at = CASE
           WHEN _assigned_bot_id IS NOT NULL THEN now()
           WHEN _status = 'available' OR _status = 'retired' THEN NULL
           ELSE assigned_at
         END,
         updated_at = now()
   WHERE id = _id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pool entry not found.');
  END IF;

  PERFORM public.log_admin_action('update_bot_token_pool_entry', NULL, NULL,
    jsonb_build_object('pool_id', _id, 'status', _status, 'assigned_bot_id', _assigned_bot_id));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- RPC: reveal token
CREATE OR REPLACE FUNCTION public.reveal_bot_token_pool_entry(_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _admin UUID := auth.uid();
  _enc BYTEA;
  _value TEXT;
BEGIN
  IF _admin IS NULL OR NOT public.has_role(_admin, 'admin'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only admins.');
  END IF;
  SELECT token_encrypted INTO _enc FROM public.bot_token_pool WHERE id = _id;
  IF _enc IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pool entry not found.');
  END IF;
  _value := extensions.pgp_sym_decrypt(_enc, public._bot_secrets_key());

  PERFORM public.log_admin_action('reveal_bot_token_pool_entry', NULL, NULL,
    jsonb_build_object('pool_id', _id));

  RETURN jsonb_build_object('ok', true, 'token', _value);
END;
$$;

-- RPC: delete entry
CREATE OR REPLACE FUNCTION public.delete_bot_token_pool_entry(_id UUID)
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
  DELETE FROM public.bot_token_pool WHERE id = _id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pool entry not found.');
  END IF;
  PERFORM public.log_admin_action('delete_bot_token_pool_entry', NULL, NULL,
    jsonb_build_object('pool_id', _id));
  RETURN jsonb_build_object('ok', true);
END;
$$;
