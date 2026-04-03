
CREATE OR REPLACE VIEW public.contacts_with_stats AS
SELECT
  c.*,
  COALESCE(cs.conversation_count, 0)::int AS conversation_count,
  cs.last_interaction
FROM public.contacts c
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS conversation_count,
    MAX(conv.last_message_at) AS last_interaction
  FROM public.conversations conv
  WHERE conv.from_email = c.email
    AND conv.team_id = c.team_id
) cs ON true;
