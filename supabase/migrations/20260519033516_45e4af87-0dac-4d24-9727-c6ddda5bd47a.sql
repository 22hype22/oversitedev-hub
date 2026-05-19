ALTER TABLE public.dashboard_team REPLICA IDENTITY FULL;
ALTER TABLE public.support_access_grants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_team;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_access_grants;