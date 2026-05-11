ALTER TABLE public.bot_active_guilds REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_active_guilds;