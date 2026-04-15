-- ═══════════════════════════════════════════════════════════════
-- Outbox commands table for reliable sending
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.outbox_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  conversation_id uuid REFERENCES public.conversations(id),
  command_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_message text,
  retry_count int NOT NULL DEFAULT 0
);

ALTER TABLE public.outbox_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can create outbox commands"
  ON public.outbox_commands FOR INSERT
  TO authenticated
  WITH CHECK (team_id = get_user_team_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Team members can view outbox commands"
  ON public.outbox_commands FOR SELECT
  TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Users can update own outbox commands"
  ON public.outbox_commands FOR UPDATE
  TO authenticated
  USING (team_id = get_user_team_id(auth.uid()) AND created_by = auth.uid());

CREATE INDEX idx_outbox_status ON public.outbox_commands (status, created_at);

-- ═══════════════════════════════════════════════════════════════
-- Sync journal for reconciliation tracking
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.sync_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id),
  mailbox_id uuid REFERENCES public.team_mailboxes(id),
  drift_type text NOT NULL,
  local_state text,
  remote_state text,
  action_taken text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view sync journal"
  ON public.sync_journal FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM team_mailboxes tm
    WHERE tm.id = sync_journal.mailbox_id
    AND tm.team_id = get_user_team_id(auth.uid())
  ));

-- ═══════════════════════════════════════════════════════════════
-- RPC: inbox_list — single-query conversation list with enrichment
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.inbox_list(
  p_mailbox_id uuid DEFAULT NULL,
  p_state text DEFAULT 'inbox',
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  seq_number int,
  subject text,
  snippet text,
  from_email text,
  from_name text,
  status text,
  state text,
  assigned_to uuid,
  assignee_name text,
  is_read boolean,
  is_noise boolean,
  priority text,
  category text,
  ai_summary text,
  last_message_at timestamptz,
  has_draft boolean,
  needs_reply boolean,
  tag_ids uuid[],
  tag_names text[],
  tag_colors text[]
)
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
    EXISTS(SELECT 1 FROM drafts d WHERE d.conversation_id = c.id AND d.created_by = _user_id) AS has_draft,
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

-- ═══════════════════════════════════════════════════════════════
-- RPC: conversation_detail — full conversation in one call
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.conversation_detail(p_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _team_id uuid;
  _result jsonb;
BEGIN
  _team_id := get_user_team_id(auth.uid());

  SELECT jsonb_build_object(
    'conversation', row_to_json(c.*),
    'assignee_name', p.full_name,
    'tags', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color))
      FROM conversation_tags ct JOIN tags t ON t.id = ct.tag_id
      WHERE ct.conversation_id = c.id
    ), '[]'::jsonb),
    'messages', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'from_email', m.from_email,
          'from_name', m.from_name,
          'to_email', m.to_email,
          'cc', m.cc,
          'body_html', m.body_html,
          'body_text', m.body_text,
          'sent_at', m.sent_at,
          'is_outbound', m.is_outbound,
          'gmail_message_id', m.gmail_message_id,
          'attachments', COALESCE((
            SELECT jsonb_agg(row_to_json(a.*))
            FROM attachments a WHERE a.message_id = m.id
          ), '[]'::jsonb)
        ) ORDER BY m.sent_at
      )
      FROM messages m WHERE m.conversation_id = c.id
    ), '[]'::jsonb),
    'comments', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', cm.id,
          'user_id', cm.user_id,
          'body', cm.body,
          'created_at', cm.created_at,
          'author_name', cp.full_name
        ) ORDER BY cm.created_at
      )
      FROM comments cm LEFT JOIN profiles cp ON cp.user_id = cm.user_id
      WHERE cm.conversation_id = c.id
    ), '[]'::jsonb),
    'contact', CASE WHEN c.contact_id IS NOT NULL THEN (
      SELECT row_to_json(co.*)
      FROM contacts co WHERE co.id = c.contact_id
    ) ELSE NULL END
  ) INTO _result
  FROM conversations c
  LEFT JOIN profiles p ON p.user_id = c.assigned_to
  WHERE c.id = p_conversation_id AND c.team_id = _team_id;

  RETURN _result;
END;
$function$;