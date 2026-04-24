-- Replace the broad self-update policy with one that forbids users from
-- modifying welcome_discount_available on their own row.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND welcome_discount_available = (
      SELECT p.welcome_discount_available
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
    )
  );