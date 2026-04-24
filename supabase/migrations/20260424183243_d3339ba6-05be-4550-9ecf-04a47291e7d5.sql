ALTER TABLE public.purchases REPLICA IDENTITY FULL;
ALTER TABLE public.pending_purchases REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_purchases;