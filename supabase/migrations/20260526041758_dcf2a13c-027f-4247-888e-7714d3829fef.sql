
ALTER TABLE public.flagged_entities
  ADD COLUMN IF NOT EXISTS bot_id uuid;

CREATE INDEX IF NOT EXISTS idx_flagged_entities_bot_id ON public.flagged_entities(bot_id);
CREATE INDEX IF NOT EXISTS idx_flagged_entities_entity ON public.flagged_entities(entity_type, entity_id);

DROP POLICY IF EXISTS "Anon bots can insert flagged entities" ON public.flagged_entities;
DROP POLICY IF EXISTS "Anon bots can view flagged entities" ON public.flagged_entities;

CREATE POLICY "Anon bots can insert flagged entities"
ON public.flagged_entities
FOR INSERT
TO anon
WITH CHECK (bot_id IS NOT NULL AND bot_id IN (SELECT id FROM public.bot_orders));

CREATE POLICY "Anon bots can view flagged entities"
ON public.flagged_entities
FOR SELECT
TO anon
USING (true);
