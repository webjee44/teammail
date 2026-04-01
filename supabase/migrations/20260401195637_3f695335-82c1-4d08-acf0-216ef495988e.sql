
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  category TEXT,
  created_by UUID NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT true,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- View: team members see shared templates + their own
CREATE POLICY "Team members can view templates"
ON public.email_templates FOR SELECT TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND (is_shared = true OR created_by = auth.uid())
);

-- Insert: team members can create
CREATE POLICY "Team members can create templates"
ON public.email_templates FOR INSERT TO authenticated
WITH CHECK (
  team_id = get_user_team_id(auth.uid())
  AND created_by = auth.uid()
);

-- Update: creator or admin
CREATE POLICY "Creators and admins can update templates"
ON public.email_templates FOR UPDATE TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'))
);

-- Delete: creator or admin
CREATE POLICY "Creators and admins can delete templates"
ON public.email_templates FOR DELETE TO authenticated
USING (
  team_id = get_user_team_id(auth.uid())
  AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'))
);

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
