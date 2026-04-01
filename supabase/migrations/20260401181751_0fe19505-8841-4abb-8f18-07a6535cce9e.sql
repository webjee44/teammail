
-- Create contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  phone TEXT,
  avatar_url TEXT,
  notes TEXT DEFAULT '',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (team_id, email)
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view contacts" ON public.contacts FOR SELECT TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can create contacts" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can update contacts" ON public.contacts FOR UPDATE TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can delete contacts" ON public.contacts FOR DELETE TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create contact_conversations junction table
CREATE TABLE public.contact_conversations (
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, conversation_id)
);

ALTER TABLE public.contact_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view contact_conversations" ON public.contact_conversations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = contact_conversations.conversation_id AND c.team_id = get_user_team_id(auth.uid())
  ));

CREATE POLICY "Team members can create contact_conversations" ON public.contact_conversations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = contact_conversations.conversation_id AND c.team_id = get_user_team_id(auth.uid())
  ));

CREATE POLICY "Team members can delete contact_conversations" ON public.contact_conversations FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = contact_conversations.conversation_id AND c.team_id = get_user_team_id(auth.uid())
  ));

-- Add contact_id to conversations
ALTER TABLE public.conversations ADD COLUMN contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX idx_contacts_team_email ON public.contacts(team_id, email);
CREATE INDEX idx_contacts_team_id ON public.contacts(team_id);
CREATE INDEX idx_conversations_contact_id ON public.conversations(contact_id);
