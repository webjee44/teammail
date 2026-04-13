
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Delete group messages first (FK constraint)
DELETE FROM whatsapp_messages
WHERE conversation_id IN (
  SELECT id FROM whatsapp_conversations WHERE phone_number LIKE '%@g.us'
);

-- Delete group conversations
DELETE FROM whatsapp_conversations
WHERE phone_number LIKE '%@g.us';

-- Create cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_whatsapp_groups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM whatsapp_messages
  WHERE conversation_id IN (
    SELECT id FROM whatsapp_conversations WHERE phone_number LIKE '%@g.us'
  );
  DELETE FROM whatsapp_conversations
  WHERE phone_number LIKE '%@g.us';
END;
$$;
