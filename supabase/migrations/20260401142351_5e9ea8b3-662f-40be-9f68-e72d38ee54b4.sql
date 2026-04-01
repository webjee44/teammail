
-- Create enum types
CREATE TYPE public.conversation_status AS ENUM ('open', 'snoozed', 'closed');
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (separate from profiles as required)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  gmail_thread_id TEXT,
  subject TEXT NOT NULL DEFAULT '(no subject)',
  snippet TEXT,
  from_email TEXT,
  from_name TEXT,
  status conversation_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  snoozed_until TIMESTAMPTZ,
  is_read BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Conversation tags (many-to-many)
CREATE TABLE public.conversation_tags (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, tag_id)
);
ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;

-- Messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  gmail_message_id TEXT,
  from_email TEXT,
  from_name TEXT,
  to_email TEXT,
  body_html TEXT,
  body_text TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_outbound BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Internal comments
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Automation rules
CREATE TABLE public.rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

-- Team invitations
CREATE TABLE public.team_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper function: get user's team_id
CREATE OR REPLACE FUNCTION public.get_user_team_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies

-- Teams: members can view their team
CREATE POLICY "Team members can view their team" ON public.teams
  FOR SELECT TO authenticated
  USING (id = public.get_user_team_id(auth.uid()));

-- Profiles: team members can see each other
CREATE POLICY "Team members can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Tags: team-scoped
CREATE POLICY "Team members can view tags" ON public.tags
  FOR SELECT TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Team members can create tags" ON public.tags
  FOR INSERT TO authenticated
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Team members can update tags" ON public.tags
  FOR UPDATE TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Team members can delete tags" ON public.tags
  FOR DELETE TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()));

-- Conversations: team-scoped
CREATE POLICY "Team members can view conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Team members can create conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Team members can update conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()));

-- Conversation tags: team-scoped via conversation
CREATE POLICY "Team members can view conversation tags" ON public.conversation_tags
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.team_id = public.get_user_team_id(auth.uid())
  ));

CREATE POLICY "Team members can manage conversation tags" ON public.conversation_tags
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.team_id = public.get_user_team_id(auth.uid())
  ));

CREATE POLICY "Team members can remove conversation tags" ON public.conversation_tags
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.team_id = public.get_user_team_id(auth.uid())
  ));

-- Messages: team-scoped via conversation
CREATE POLICY "Team members can view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.team_id = public.get_user_team_id(auth.uid())
  ));

CREATE POLICY "Team members can create messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.team_id = public.get_user_team_id(auth.uid())
  ));

-- Comments: team-scoped via conversation
CREATE POLICY "Team members can view comments" ON public.comments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.team_id = public.get_user_team_id(auth.uid())
  ));

CREATE POLICY "Team members can create comments" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.team_id = public.get_user_team_id(auth.uid())
    )
  );

-- Rules: team-scoped
CREATE POLICY "Team members can view rules" ON public.rules
  FOR SELECT TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Admins can manage rules" ON public.rules
  FOR ALL TO authenticated
  USING (
    team_id = public.get_user_team_id(auth.uid()) AND
    public.has_role(auth.uid(), 'admin')
  );

-- Team invitations
CREATE POLICY "Team members can view invitations" ON public.team_invitations
  FOR SELECT TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Admins can create invitations" ON public.team_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id = public.get_user_team_id(auth.uid()) AND
    public.has_role(auth.uid(), 'admin')
  );

-- Triggers for updated_at
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON public.rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for conversations and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- Indexes
CREATE INDEX idx_conversations_team_id ON public.conversations(team_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_assigned_to ON public.conversations(assigned_to);
CREATE INDEX idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_comments_conversation_id ON public.comments(conversation_id);
CREATE INDEX idx_profiles_team_id ON public.profiles(team_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
