
CREATE OR REPLACE FUNCTION public.get_sent_conversation_ids()
RETURNS TABLE(conversation_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT DISTINCT m.conversation_id
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.is_outbound = true
    AND c.team_id = get_user_team_id(auth.uid())
$$;
