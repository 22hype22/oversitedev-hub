-- Helper: check super admin by email from JWT
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'everant00@gmail.com',
    false
  );
$$;

-- Portfolio items table
CREATE TABLE public.portfolio_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'Build',
  title TEXT NOT NULL,
  description TEXT,
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolio items are publicly viewable"
ON public.portfolio_items FOR SELECT
USING (true);

CREATE POLICY "Super admin can insert portfolio items"
ON public.portfolio_items FOR INSERT
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admin can update portfolio items"
ON public.portfolio_items FOR UPDATE
USING (public.is_super_admin());

CREATE POLICY "Super admin can delete portfolio items"
ON public.portfolio_items FOR DELETE
USING (public.is_super_admin());

-- Reuse existing updated_at trigger function if present, otherwise create
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_portfolio_items_updated_at
BEFORE UPDATE ON public.portfolio_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_portfolio_items_sort ON public.portfolio_items (category, sort_order);

-- Storage bucket for portfolio media
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Portfolio media is publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolio');

CREATE POLICY "Super admin can upload portfolio media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portfolio' AND public.is_super_admin());

CREATE POLICY "Super admin can update portfolio media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portfolio' AND public.is_super_admin());

CREATE POLICY "Super admin can delete portfolio media"
ON storage.objects FOR DELETE
USING (bucket_id = 'portfolio' AND public.is_super_admin());