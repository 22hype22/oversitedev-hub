-- Return each saved secret's character LENGTH (not the value) from the metadata
-- RPC, so the dashboard's masked "dots" can mirror the real length of every
-- credential — including ones set before this change — instead of a fixed row.
--
-- The value stays encrypted at rest; this decrypts inside the already
-- owner/admin/support-gated SECURITY DEFINER function purely to take its length,
-- and returns only the integer count. The plaintext is never exposed.

DROP FUNCTION IF EXISTS public.get_bot_secrets_metadata(UUID);

CREATE OR REPLACE FUNCTION public.get_bot_secrets_metadata(_bot_id UUID)
RETURNS TABLE (
  addon_id TEXT, key TEXT, label TEXT, description TEXT, placeholder TEXT,
  is_required BOOLEAN, sort_order INTEGER, is_set BOOLEAN, last_four TEXT,
  updated_at TIMESTAMPTZ, is_managed BOOLEAN, value_length INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
         COALESCE(bs.managed, false),
         CASE
           WHEN bs.id IS NULL THEN 0
           ELSE COALESCE(
             char_length(extensions.pgp_sym_decrypt(bs.value_encrypted, public._bot_secrets_key())),
             0)
         END
  FROM public.bot_secret_slots s
  LEFT JOIN public.bot_secrets bs ON bs.bot_id = _bot_id AND bs.key = s.key
  ORDER BY s.sort_order, s.label;
END;
$$;

REVOKE ALL ON FUNCTION public.get_bot_secrets_metadata(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bot_secrets_metadata(UUID) TO authenticated;
