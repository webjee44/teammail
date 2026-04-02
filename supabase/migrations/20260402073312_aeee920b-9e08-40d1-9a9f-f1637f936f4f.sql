
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  assigned_to UUID,
  created_by UUID NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can create tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (team_id = get_user_team_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Team members can update tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can delete tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
