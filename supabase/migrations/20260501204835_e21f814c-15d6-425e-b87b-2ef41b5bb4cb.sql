-- 1) Function: get the Discord client_id for a bot the caller owns
CREATE OR REPLACE FUNCTION public.get_bot_client_id(_bot_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.client_id
  FROM public.bot_token_pool p
  JOIN public.bot_orders o ON o.id = p.assigned_bot_id
  WHERE p.assigned_bot_id = _bot_id
    AND o.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_bot_client_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bot_client_id(uuid) TO authenticated;

-- 2) Admin-controlled per-addon "included" overrides
CREATE TABLE IF NOT EXISTS public.bot_addon_overrides (
  addon_id text PRIMARY KEY,
  included boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_addon_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read addon overrides" ON public.bot_addon_overrides;
CREATE POLICY "Anyone can read addon overrides"
ON public.bot_addon_overrides
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert addon overrides" ON public.bot_addon_overrides;
CREATE POLICY "Admins can insert addon overrides"
ON public.bot_addon_overrides
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update addon overrides" ON public.bot_addon_overrides;
CREATE POLICY "Admins can update addon overrides"
ON public.bot_addon_overrides
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete addon overrides" ON public.bot_addon_overrides;
CREATE POLICY "Admins can delete addon overrides"
ON public.bot_addon_overrides
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_addon_overrides;