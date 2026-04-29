CREATE OR REPLACE FUNCTION public.create_support_access_code(_expires_in_hours INTEGER, _notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _code TEXT;
  _expires TIMESTAMPTZ;
  _id UUID;
  _alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  _seg1 TEXT := '';
  _seg2 TEXT := '';
  _bytes BYTEA;
  i INT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;
  IF _expires_in_hours IS NULL OR _expires_in_hours < 1 OR _expires_in_hours > 24 * 30 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Expiry must be between 1 hour and 30 days.');
  END IF;
  IF _notes IS NOT NULL AND length(_notes) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Notes too long.');
  END IF;

  _bytes := extensions.gen_random_bytes(8);
  FOR i IN 0..3 LOOP
    _seg1 := _seg1 || substr(_alphabet, (get_byte(_bytes, i) % length(_alphabet)) + 1, 1);
  END LOOP;
  FOR i IN 4..7 LOOP
    _seg2 := _seg2 || substr(_alphabet, (get_byte(_bytes, i) % length(_alphabet)) + 1, 1);
  END LOOP;

  _code := 'SUP-' || _seg1 || '-' || _seg2;
  _expires := now() + (_expires_in_hours || ' hours')::interval;

  INSERT INTO public.support_access_codes (owner_user_id, code, expires_at, notes)
  VALUES (_user_id, _code, _expires, _notes)
  RETURNING id INTO _id;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'code', _code, 'expires_at', _expires);
END;
$$;