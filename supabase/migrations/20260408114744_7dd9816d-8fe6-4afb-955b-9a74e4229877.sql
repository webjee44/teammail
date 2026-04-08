
-- Create campaigns table
CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  from_email text,
  status text NOT NULL DEFAULT 'draft',
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  scheduled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can create campaigns"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (team_id = get_user_team_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Creators can update own campaigns"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (team_id = get_user_team_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Creators can delete own campaigns"
  ON public.campaigns FOR DELETE TO authenticated
  USING (team_id = get_user_team_id(auth.uid()) AND created_by = auth.uid());

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create campaign_recipients table
CREATE TABLE public.campaign_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  email text NOT NULL,
  name text,
  company text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view campaign recipients"
  ON public.campaign_recipients FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_recipients.campaign_id
    AND c.team_id = get_user_team_id(auth.uid())
  ));

CREATE POLICY "Team members can create campaign recipients"
  ON public.campaign_recipients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_recipients.campaign_id
    AND c.team_id = get_user_team_id(auth.uid())
  ));

CREATE POLICY "Team members can update campaign recipients"
  ON public.campaign_recipients FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_recipients.campaign_id
    AND c.team_id = get_user_team_id(auth.uid())
  ));

CREATE POLICY "Team members can delete campaign recipients"
  ON public.campaign_recipients FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_recipients.campaign_id
    AND c.team_id = get_user_team_id(auth.uid())
  ));

CREATE INDEX idx_campaign_recipients_campaign_id ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_campaigns_team_id ON public.campaigns(team_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
