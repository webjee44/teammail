-- Create enum for conversation state (system location)
CREATE TYPE conversation_state AS ENUM ('inbox', 'archived', 'trash', 'spam');

-- Add state column to conversations
ALTER TABLE conversations 
  ADD COLUMN state conversation_state NOT NULL DEFAULT 'inbox';

-- Performance indexes
CREATE INDEX idx_conversations_state ON conversations (state);
CREATE INDEX idx_conversations_mailbox_state_last_msg 
  ON conversations (mailbox_id, state, last_message_at DESC);