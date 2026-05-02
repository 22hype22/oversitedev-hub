ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_channel_cache;
ALTER TABLE public.bot_channel_cache REPLICA IDENTITY FULL;