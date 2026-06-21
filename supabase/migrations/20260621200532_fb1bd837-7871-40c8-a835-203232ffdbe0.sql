
-- bot_config: ensure authenticated role has table grants AND owner/team policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_config TO authenticated;
GRANT ALL ON public.bot_config TO service_role;

-- Recreate policies using the same pattern as post_types
DROP POLICY IF EXISTS "Users can manage their own bot config" ON public.bot_config;
DROP POLICY IF EXISTS "Team: manage bot config" ON public.bot_config;

CREATE POLICY "Owners manage bot_config"
ON public.bot_config
FOR ALL
TO authenticated
USING (
  bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid())
)
WITH CHECK (
  bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid())
);

CREATE POLICY "Team manages bot_config"
ON public.bot_config
FOR ALL
TO authenticated
USING (public.has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'))
WITH CHECK (public.has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'));
