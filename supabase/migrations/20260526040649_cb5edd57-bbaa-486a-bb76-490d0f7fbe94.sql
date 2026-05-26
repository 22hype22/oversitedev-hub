CREATE TABLE IF NOT EXISTS public.protection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  guild_id text NOT NULL,
  event_type text NOT NULL,
  target_id text,
  action_taken text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_protection_events_bot_guild ON public.protection_events(bot_id, guild_id, created_at DESC);
ALTER TABLE public.protection_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.banned_members_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  guild_id text NOT NULL,
  user_id text NOT NULL,
  username text,
  roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  joined_at timestamptz,
  banned_at timestamptz NOT NULL DEFAULT now(),
  ban_reason text,
  recovered boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_banned_members_backup_bot_guild ON public.banned_members_backup(bot_id, guild_id, banned_at DESC);
CREATE INDEX IF NOT EXISTS idx_banned_members_backup_user ON public.banned_members_backup(bot_id, guild_id, user_id);
ALTER TABLE public.banned_members_backup ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.nuke_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL,
  guild_id text NOT NULL,
  actor_id text NOT NULL,
  action_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nuke_actions_bot_guild ON public.nuke_actions(bot_id, guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nuke_actions_actor ON public.nuke_actions(bot_id, guild_id, actor_id, created_at DESC);
ALTER TABLE public.nuke_actions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.flagged_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text NOT NULL,
  entity_type text NOT NULL,
  reason text,
  flagged_by_guild_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flagged_entities_lookup ON public.flagged_entities(entity_type, entity_id);
ALTER TABLE public.flagged_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role manages protection_events" ON public.protection_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role manages banned_members_backup" ON public.banned_members_backup FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role manages nuke_actions" ON public.nuke_actions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role manages flagged_entities" ON public.flagged_entities FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Bot members can view protection_events" ON public.protection_events
  FOR SELECT TO authenticated
  USING (public.has_bot_team_access(auth.uid(), bot_id));

CREATE POLICY "Bot members can view banned_members_backup" ON public.banned_members_backup
  FOR SELECT TO authenticated
  USING (public.has_bot_team_access(auth.uid(), bot_id));

CREATE POLICY "Bot members can view nuke_actions" ON public.nuke_actions
  FOR SELECT TO authenticated
  USING (public.has_bot_team_access(auth.uid(), bot_id));
