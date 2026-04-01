
-- Attachments table
CREATE TABLE public.attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view attachments"
ON public.attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = attachments.message_id
    AND c.team_id = get_user_team_id(auth.uid())
  )
);

CREATE POLICY "Team members can insert attachments"
ON public.attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = attachments.message_id
    AND c.team_id = get_user_team_id(auth.uid())
  )
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

CREATE POLICY "Public read access on attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments');

CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');
