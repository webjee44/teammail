
CREATE POLICY "Team members can delete conversations"
ON public.conversations
FOR DELETE
TO authenticated
USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can delete messages"
ON public.messages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND c.team_id = get_user_team_id(auth.uid())
  )
);
