
-- Table to store which Gmail mailboxes to sync per team
CREATE TABLE public.team_mailboxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  label TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, email)
);

-- Enable RLS
ALTER TABLE public.team_mailboxes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Team members can view mailboxes"
ON public.team_mailboxes FOR SELECT
TO authenticated
USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Admins can create mailboxes"
ON public.team_mailboxes FOR INSERT
TO authenticated
WITH CHECK (team_id = get_user_team_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update mailboxes"
ON public.team_mailboxes FOR UPDATE
TO authenticated
USING (team_id = get_user_team_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete mailboxes"
ON public.team_mailboxes FOR DELETE
TO authenticated
USING (team_id = get_user_team_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_team_mailboxes_updated_at
BEFORE UPDATE ON public.team_mailboxes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
