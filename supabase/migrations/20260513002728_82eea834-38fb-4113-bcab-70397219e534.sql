-- Add owner_key to portfolio_items so we can scope items per team member
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS owner_key TEXT NOT NULL DEFAULT 'owner';

CREATE INDEX IF NOT EXISTS idx_portfolio_items_owner_sort
  ON public.portfolio_items (owner_key, category, sort_order);

-- Helper: can the current user manage a given owner_key's portfolio?
CREATE OR REPLACE FUNCTION public.can_manage_portfolio(_owner_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT email FROM auth.users WHERE id = auth.uid()
    ) = CASE _owner_key
      WHEN 'owner'   THEN 'everant00@gmail.com'
      WHEN 'plugyxz' THEN 'monb11190@gmail.com'
      ELSE NULL
    END,
    false
  );
$$;

-- Helper: is the current user any portfolio manager (used for storage)?
CREATE OR REPLACE FUNCTION public.is_portfolio_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT email FROM auth.users WHERE id = auth.uid())
      IN ('everant00@gmail.com', 'monb11190@gmail.com'),
    false
  );
$$;

-- Replace portfolio_items write policies with owner-scoped checks
DROP POLICY IF EXISTS "Super admin can insert portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Super admin can update portfolio items" ON public.portfolio_items;
DROP POLICY IF EXISTS "Super admin can delete portfolio items" ON public.portfolio_items;

CREATE POLICY "Owners can insert their portfolio items"
ON public.portfolio_items FOR INSERT
WITH CHECK (public.can_manage_portfolio(owner_key));

CREATE POLICY "Owners can update their portfolio items"
ON public.portfolio_items FOR UPDATE
USING (public.can_manage_portfolio(owner_key))
WITH CHECK (public.can_manage_portfolio(owner_key));

CREATE POLICY "Owners can delete their portfolio items"
ON public.portfolio_items FOR DELETE
USING (public.can_manage_portfolio(owner_key));

-- Replace storage policies so both managers can upload/edit portfolio media
DROP POLICY IF EXISTS "Super admin can upload portfolio media" ON storage.objects;
DROP POLICY IF EXISTS "Super admin can update portfolio media" ON storage.objects;
DROP POLICY IF EXISTS "Super admin can delete portfolio media" ON storage.objects;

CREATE POLICY "Portfolio managers can upload portfolio media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portfolio' AND public.is_portfolio_manager());

CREATE POLICY "Portfolio managers can update portfolio media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portfolio' AND public.is_portfolio_manager());

CREATE POLICY "Portfolio managers can delete portfolio media"
ON storage.objects FOR DELETE
USING (bucket_id = 'portfolio' AND public.is_portfolio_manager());