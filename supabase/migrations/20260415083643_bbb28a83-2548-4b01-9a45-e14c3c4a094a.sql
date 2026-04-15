-- Add history_id for Gmail incremental sync
ALTER TABLE public.team_mailboxes ADD COLUMN history_id bigint;

-- Update search_inbox to exclude trash and spam
CREATE OR REPLACE FUNCTION public.search_inbox(p_query text, p_limit integer DEFAULT 20)
 RETURNS TABLE(result_type text, id uuid, conversation_id uuid, label text, subtitle text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _team_id uuid;
BEGIN
  _team_id := get_user_team_id(auth.uid());

  RETURN QUERY
  SELECT
    r.result_type, r.id, r.conversation_id, r.label, r.subtitle
  FROM (
    SELECT
      'conversation'::text AS result_type,
      c.id,
      c.id AS conversation_id,
      c.subject AS label,
      COALESCE(c.from_name, c.from_email, '')::text AS subtitle
    FROM conversations c
    WHERE c.team_id = _team_id
      AND c.state NOT IN ('trash', 'spam')
      AND (
        c.subject ILIKE '%' || p_query || '%'
        OR c.from_email ILIKE '%' || p_query || '%'
        OR c.from_name ILIKE '%' || p_query || '%'
      )
    ORDER BY c.last_message_at DESC
    LIMIT p_limit
  ) r

  UNION ALL

  SELECT
    r2.result_type, r2.id, r2.conversation_id, r2.label, r2.subtitle
  FROM (
    SELECT
      'message'::text AS result_type,
      m.id,
      m.conversation_id,
      COALESCE(c2.subject, '(sans sujet)')::text AS label,
      LEFT(m.body_text, 120)::text AS subtitle
    FROM messages m
    JOIN conversations c2 ON c2.id = m.conversation_id
    WHERE c2.team_id = _team_id
      AND c2.state NOT IN ('trash', 'spam')
      AND m.body_text ILIKE '%' || p_query || '%'
    ORDER BY m.sent_at DESC
    LIMIT p_limit
  ) r2;
END;
$function$;