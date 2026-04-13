
-- Add unique constraint on gmail_message_id to prevent duplicate messages from gmail-sync
CREATE UNIQUE INDEX IF NOT EXISTS messages_gmail_message_id_unique 
ON public.messages (gmail_message_id) 
WHERE gmail_message_id IS NOT NULL;
