DROP FUNCTION IF EXISTS public.search_inbox(text, integer);

CREATE OR REPLACE FUNCTION public.search_inbox(
  p_query text,
  p_mailbox_id uuid DEFAULT NULL,
  p_has_attachment boolean DEFAULT false,
  p_since timestamptz DEFAULT NULL,
  p_from_me boolean DEFAULT false,
  p_unread_only boolean DEFAULT false,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  conversation_id uuid,
  subject text,
  snippet text,
  from_name text,
  from_email text,
  mailbox_email text,
  last_message_at timestamptz,
  has_attachment boolean,
  is_unread boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _team_id uuid;
  _mailbox_email text;
  _like text;
BEGIN
  _team_id := get_user_team_id(auth.uid());
  _like := '%' || p_query || '%';

  IF p_from_me AND p_mailbox_id IS NOT NULL THEN
    SELECT email INTO _mailbox_email FROM team_mailboxes WHERE id = p_mailbox_id;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS conversation_id,
    c.subject,
    c.snippet,
    c.from_name,
    c.from_email,
    tm.email AS mailbox_email,
    c.last_message_at,
    EXISTS(
      SELECT 1 FROM messages m
      JOIN attachments a ON a.message_id = m.id
      WHERE m.conversation_id = c.id
    ) AS has_attachment,
    NOT c.is_read AS is_unread
  FROM conversations c
  LEFT JOIN team_mailboxes tm ON tm.id = c.mailbox_id
  WHERE c.team_id = _team_id
    AND c.state NOT IN ('trash', 'spam')
    AND (p_mailbox_id IS NULL OR c.mailbox_id = p_mailbox_id)
    AND (p_since IS NULL OR c.last_message_at >= p_since)
    AND (NOT p_unread_only OR c.is_read = false)
    AND (
      p_query = ''
      OR c.subject ILIKE _like
      OR c.from_email ILIKE _like
      OR c.from_name ILIKE _like
      OR c.snippet ILIKE _like
      OR EXISTS (
        SELECT 1 FROM messages m
        WHERE m.conversation_id = c.id
          AND m.body_text ILIKE _like
      )
    )
    AND (
      NOT p_has_attachment
      OR EXISTS (
        SELECT 1 FROM messages m
        JOIN attachments a ON a.message_id = m.id
        WHERE m.conversation_id = c.id
      )
    )
    AND (
      NOT p_from_me
      OR EXISTS (
        SELECT 1 FROM messages m
        WHERE m.conversation_id = c.id
          AND m.is_outbound = true
          AND m.sent_at = (
            SELECT MAX(m2.sent_at) FROM messages m2 WHERE m2.conversation_id = c.id
          )
          AND (_mailbox_email IS NULL OR lower(m.from_email) = lower(_mailbox_email))
      )
    )
  ORDER BY c.last_message_at DESC
  LIMIT p_limit;
END;
$$;