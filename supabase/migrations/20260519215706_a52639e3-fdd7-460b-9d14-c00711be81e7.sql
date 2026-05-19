CREATE POLICY "Team members can read team roster"
ON public.dashboard_team
FOR SELECT
TO authenticated
USING (
  public.has_team_access(auth.uid(), owner_user_id)
);