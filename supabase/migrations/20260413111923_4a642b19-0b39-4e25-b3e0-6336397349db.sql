
CREATE OR REPLACE FUNCTION public.get_actionable_count(_mailbox_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::int
  FROM conversations c
  WHERE c.team_id = get_user_team_id(auth.uid())
    AND c.status = 'open'
    AND c.is_noise = false
    AND (_mailbox_id IS NULL OR c.mailbox_id = _mailbox_id)
    AND NOT EXISTS (
      -- Exclude conversations where from_email is one of our mailboxes (outbound-initiated)
      SELECT 1 FROM team_mailboxes tm
      WHERE tm.team_id = c.team_id
        AND lower(tm.email) = lower(c.from_email)
    )
    AND NOT EXISTS (
      -- Exclude conversations where the very last message is outbound (already replied)
      SELECT 1 FROM messages m
      WHERE m.conversation_id = c.id
        AND m.is_outbound = true
        AND NOT EXISTS (
          SELECT 1 FROM messages m2
          WHERE m2.conversation_id = c.id
            AND m2.sent_at > m.sent_at
        )
    )
$$;
