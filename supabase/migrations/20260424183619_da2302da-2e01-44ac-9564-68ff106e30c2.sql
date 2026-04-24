CREATE POLICY "Admins can delete purchases"
ON public.purchases FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pending purchases"
ON public.pending_purchases FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));