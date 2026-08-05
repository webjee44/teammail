CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent ON public.messages (conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_body_text_trgm ON public.messages USING gin (body_text extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_conversations_subject_trgm ON public.conversations USING gin (subject extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_conversations_snippet_trgm ON public.conversations USING gin (snippet extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_conversations_from_email_trgm ON public.conversations USING gin (from_email extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_conversations_from_name_trgm ON public.conversations USING gin (from_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON public.attachments (message_id);