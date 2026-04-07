
-- WhatsApp conversations table
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID,
  wasender_chat_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_conv_team ON public.whatsapp_conversations(team_id);
CREATE INDEX idx_wa_conv_phone ON public.whatsapp_conversations(phone_number);
CREATE INDEX idx_wa_conv_last_msg ON public.whatsapp_conversations(last_message_at DESC);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view whatsapp conversations"
  ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can create whatsapp conversations"
  ON public.whatsapp_conversations FOR INSERT TO authenticated
  WITH CHECK (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can update whatsapp conversations"
  ON public.whatsapp_conversations FOR UPDATE TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can delete whatsapp conversations"
  ON public.whatsapp_conversations FOR DELETE TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

-- WhatsApp messages table
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  wasender_message_id TEXT,
  from_phone TEXT,
  from_name TEXT,
  to_phone TEXT,
  body TEXT,
  media_url TEXT,
  media_type TEXT,
  is_outbound BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_msg_conv ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_wa_msg_sent ON public.whatsapp_messages(sent_at);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view whatsapp messages"
  ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.whatsapp_conversations wc
    WHERE wc.id = whatsapp_messages.conversation_id
    AND wc.team_id = get_user_team_id(auth.uid())
  ));

CREATE POLICY "Team members can create whatsapp messages"
  ON public.whatsapp_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.whatsapp_conversations wc
    WHERE wc.id = whatsapp_messages.conversation_id
    AND wc.team_id = get_user_team_id(auth.uid())
  ));

-- Trigger for updated_at on whatsapp_conversations
CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for whatsapp messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
