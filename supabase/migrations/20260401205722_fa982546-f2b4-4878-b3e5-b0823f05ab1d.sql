
CREATE POLICY "Admins can delete invitations"
ON public.team_invitations FOR DELETE
TO authenticated
USING (team_id = get_user_team_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
