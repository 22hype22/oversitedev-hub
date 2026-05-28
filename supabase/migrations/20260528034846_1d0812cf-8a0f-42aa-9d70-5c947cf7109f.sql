CREATE POLICY "Team can update verification_queue"
  ON public.verification_queue FOR UPDATE TO authenticated
  USING (has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'))
  WITH CHECK (has_bot_team_perm(auth.uid(), bot_id, 'edit_bot_config'));