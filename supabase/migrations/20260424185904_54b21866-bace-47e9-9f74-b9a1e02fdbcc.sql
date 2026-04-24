
-- 1. product_versions: replace public-read policy with admin + buyer-only
DROP POLICY IF EXISTS "Anyone can view product versions" ON public.product_versions;

CREATE POLICY "Admins can view product versions"
  ON public.product_versions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Buyers can view purchased product versions"
  ON public.product_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases pu
      WHERE pu.product_id = product_versions.product_id
        AND pu.user_id = auth.uid()
        AND pu.status = 'paid'
    )
    OR EXISTS (
      SELECT 1
      FROM public.pending_purchases pp
      JOIN public.profiles pr ON lower(pr.roblox_username) = lower(pp.roblox_username)
      WHERE pp.product_id = product_versions.product_id
        AND pp.status = 'fulfilled'
        AND pr.user_id = auth.uid()
    )
  );

-- 2. Recreate public_products view as security_invoker so it respects caller RLS
ALTER VIEW public.public_products SET (security_invoker = true);

-- 3. Realtime channel access: restrict purchases / pending_purchases topic subscriptions
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users subscribe to own purchase channels" ON realtime.messages;
CREATE POLICY "Users subscribe to own purchase channels"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR realtime.topic() = ('user-purchases-' || auth.uid()::text)
    OR realtime.topic() = ('dashboard-purchases-' || auth.uid()::text)
  );

-- 4. Fix mutable search_path on email helper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
