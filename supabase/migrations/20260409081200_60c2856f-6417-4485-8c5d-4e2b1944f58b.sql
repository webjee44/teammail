CREATE POLICY "Team members can delete whatsapp messages"
ON public.whatsapp_messages
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM whatsapp_conversations wc
  WHERE wc.id = whatsapp_messages.conversation_id
    AND wc.team_id = get_user_team_id(auth.uid())
));