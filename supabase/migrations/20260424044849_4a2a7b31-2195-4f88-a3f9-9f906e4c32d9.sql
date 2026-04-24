
-- Add purchase_type and parent_purchase_id to track upgrades
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'initial',
  ADD COLUMN IF NOT EXISTS parent_purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL;

-- Add admin update policy on purchases (so admins can manually bump version)
DROP POLICY IF EXISTS "Admins can update purchases" ON public.purchases;
CREATE POLICY "Admins can update purchases"
  ON public.purchases
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add service-role-equivalent insert for purchases (used by webhook/edge functions)
-- Already inserted via service role which bypasses RLS, no policy needed.

-- Subscriptions: ensure columns from canonical schema
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz;

-- Helper: latest version per product (used by membership-aware downloads)
CREATE OR REPLACE FUNCTION public.has_active_membership(_user_id uuid, _env text DEFAULT 'sandbox')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND environment = _env
      AND (
        (status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end IS NOT NULL AND current_period_end > now())
      )
  );
$$;
