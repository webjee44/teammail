ALTER TABLE public.conversations
ADD COLUMN mailbox_id uuid REFERENCES public.team_mailboxes(id) ON DELETE SET NULL;

CREATE INDEX idx_conversations_mailbox_id ON public.conversations(mailbox_id);