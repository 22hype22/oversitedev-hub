
-- Create product_categories table for dynamic, reorderable category tabs
CREATE TABLE public.product_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can view product categories"
  ON public.product_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins can write
CREATE POLICY "Admins can insert product categories"
  ON public.product_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update product categories"
  ON public.product_categories
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete product categories"
  ON public.product_categories
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Timestamp trigger
CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with existing defaults
INSERT INTO public.product_categories (name, sort_order) VALUES
  ('Systems', 1),
  ('Assets', 2)
ON CONFLICT (name) DO NOTHING;
