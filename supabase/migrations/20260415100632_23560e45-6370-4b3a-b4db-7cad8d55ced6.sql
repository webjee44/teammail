CREATE OR REPLACE FUNCTION public.inbox_list(p_mailbox_id uuid DEFAULT NULL::uuid, p_state text DEFAULT 'inbox'::text, p_status text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, seq_number integer, subject text, snippet text, from_email text, from_name text, status text, state text, assigned_to uuid, assignee_name text, is_read boolean, is_noise boolean, priority text, category text, ai_summary text, last_message_at timestamp with time zone, has_draft boolean, needs_reply boolean, tag_ids uuid[], tag_names text[], tag_colors text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _team_id uuid;
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  _team_id := get_user_team_id(_user_id);

  RETURN QUERY
  SELECT
    c.id,
    c.seq_number,
    c.subject,
    c.snippet,
    c.from_email,
    c.from_name,
    c.status::text,
    c.state::text,
    c.assigned_to,
    p.full_name AS assignee_name,
    c.is_read,
    c.is_noise,
    c.priority,
    c.category,
    c.ai_summary,
    c.last_message_at,
    EXISTS(SELECT 1 FROM drafts d WHERE d.conversation_id = c.id AND d.created_by = _user_id AND d.status = 'draft') AS has_draft,
    EXISTS(
      SELECT 1 FROM messages m
      WHERE m.conversation_id = c.id
      AND NOT m.is_outbound
      AND NOT EXISTS(
        SELECT 1 FROM messages m2
        WHERE m2.conversation_id = c.id AND m2.sent_at > m.sent_at
      )
    ) AS needs_reply,
    COALESCE(array_agg(t.id) FILTER (WHERE t.id IS NOT NULL), '{}') AS tag_ids,
    COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tag_names,
    COALESCE(array_agg(t.color) FILTER (WHERE t.color IS NOT NULL), '{}') AS tag_colors
  FROM conversations c
  LEFT JOIN profiles p ON p.user_id = c.assigned_to
  LEFT JOIN conversation_tags ct ON ct.conversation_id = c.id
  LEFT JOIN tags t ON t.id = ct.tag_id
  WHERE c.team_id = _team_id
    AND c.state = p_state::conversation_state
    AND (p_status IS NULL OR c.status::text = p_status)
    AND (p_mailbox_id IS NULL OR c.mailbox_id = p_mailbox_id)
  GROUP BY c.id, c.seq_number, c.subject, c.snippet, c.from_email, c.from_name,
           c.status, c.state, c.assigned_to, p.full_name, c.is_read, c.is_noise,
           c.priority, c.category, c.ai_summary, c.last_message_at
  ORDER BY c.last_message_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;