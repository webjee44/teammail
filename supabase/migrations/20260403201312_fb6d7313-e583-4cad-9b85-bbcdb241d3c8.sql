
CREATE TABLE public.drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  to_email text,
  from_email text,
  subject text,
  body text,
  attachments jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one draft per user per conversation (null conversation_id allowed for new mails)
CREATE UNIQUE INDEX drafts_conv_user_unique ON public.drafts (conversation_id, created_by) WHERE conversation_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

-- Team members can view all drafts in their team
CREATE POLICY "Team members can view drafts"
ON public.drafts FOR SELECT
TO authenticated
USING (team_id = get_user_team_id(auth.uid()));

-- Users can create their own drafts
CREATE POLICY "Users can create drafts"
ON public.drafts FOR INSERT
TO authenticated
WITH CHECK (team_id = get_user_team_id(auth.uid()) AND created_by = auth.uid());

-- Users can update their own drafts
CREATE POLICY "Users can update own drafts"
ON public.drafts FOR UPDATE
TO authenticated
USING (created_by = auth.uid() AND team_id = get_user_team_id(auth.uid()));

-- Users can delete their own drafts
CREATE POLICY "Users can delete own drafts"
ON public.drafts FOR DELETE
TO authenticated
USING (created_by = auth.uid() AND team_id = get_user_team_id(auth.uid()));

-- Auto-update updated_at
CREATE TRIGGER update_drafts_updated_at
BEFORE UPDATE ON public.drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
