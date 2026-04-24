-- Allow users to view their own fulfilled gamepass purchases by linking
-- pending_purchases.roblox_username to their profiles.roblox_username (case-insensitive).
CREATE POLICY "Users can view own pending purchases"
ON public.pending_purchases
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = auth.uid()
      AND lower(pr.roblox_username) = lower(pending_purchases.roblox_username)
  )
);