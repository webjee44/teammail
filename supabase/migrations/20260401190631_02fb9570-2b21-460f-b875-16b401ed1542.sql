
CREATE TABLE public.scheduled_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  from_email text NOT NULL,
  attachments jsonb,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view scheduled emails"
  ON public.scheduled_emails FOR SELECT
  TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can create scheduled emails"
  ON public.scheduled_emails FOR INSERT
  TO authenticated
  WITH CHECK (team_id = get_user_team_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Users can update own scheduled emails"
  ON public.scheduled_emails FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Users can delete own scheduled emails"
  ON public.scheduled_emails FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() AND team_id = get_user_team_id(auth.uid()));

CREATE TRIGGER update_scheduled_emails_updated_at
  BEFORE UPDATE ON public.scheduled_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
