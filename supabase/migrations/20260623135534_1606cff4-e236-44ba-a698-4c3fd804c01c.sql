GRANT SELECT ON public.posts TO authenticated;

CREATE POLICY "Owners read posts"
ON public.posts FOR SELECT
TO authenticated
USING (bot_id IN (SELECT id FROM public.bot_orders WHERE user_id = auth.uid()));

CREATE POLICY "Team reads posts"
ON public.posts FOR SELECT
TO authenticated
USING (public.has_bot_team_perm(auth.uid(), bot_id, 'view_dashboard'));

CREATE POLICY "Platform staff reads posts"
ON public.posts FOR SELECT
TO authenticated
USING (public.is_platform_staff(auth.uid()));