-- Track buyer intent so we can match it to a Roblox group sale within a recent window
CREATE TABLE public.pending_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  roblox_user_id BIGINT NOT NULL,
  roblox_username TEXT NOT NULL,
  gamepass_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | fulfilled | expired
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMPTZ
);

CREATE INDEX idx_pending_purchases_lookup
  ON public.pending_purchases (roblox_user_id, gamepass_id, status, created_at DESC);

ALTER TABLE public.pending_purchases ENABLE ROW LEVEL SECURITY;

-- Anyone can create a pending purchase (the storefront is public, no login required to buy with Robux).
-- The edge function uses the service role to read/update, so no SELECT/UPDATE policies are exposed to clients.
CREATE POLICY "Anyone can create a pending purchase"
ON public.pending_purchases
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view pending purchases"
ON public.pending_purchases
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));