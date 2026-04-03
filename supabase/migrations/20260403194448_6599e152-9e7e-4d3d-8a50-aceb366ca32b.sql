CREATE UNIQUE INDEX IF NOT EXISTS conversations_gmail_thread_mailbox_unique 
ON conversations (gmail_thread_id, mailbox_id) 
WHERE gmail_thread_id IS NOT NULL AND mailbox_id IS NOT NULL;