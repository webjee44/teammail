CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for fast ILIKE search
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON public.contacts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm ON public.contacts USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_company_trgm ON public.contacts USING gin (company gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_wa_conv_contact_name_trgm ON public.whatsapp_conversations USING gin (contact_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wa_conv_phone_trgm ON public.whatsapp_conversations USING gin (phone_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wa_conv_last_message_trgm ON public.whatsapp_conversations USING gin (last_message gin_trgm_ops);

-- Also help inbox search RPC (subject / from)
CREATE INDEX IF NOT EXISTS idx_conversations_subject_trgm ON public.conversations USING gin (subject gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_conversations_from_email_trgm ON public.conversations USING gin (from_email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_conversations_from_name_trgm ON public.conversations USING gin (from_name gin_trgm_ops);