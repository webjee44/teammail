
-- Merge duplicate WhatsApp conversations: move messages to the kept conversation, delete duplicates

-- For group 120363407417211516@g.us: keep 007972ed, merge rest
UPDATE whatsapp_messages 
SET conversation_id = '007972ed-316b-429c-a353-33b29382a2e5'
WHERE conversation_id IN (
  SELECT id FROM whatsapp_conversations 
  WHERE wasender_chat_id = '120363407417211516@g.us' 
  AND id != '007972ed-316b-429c-a353-33b29382a2e5'
);

DELETE FROM whatsapp_conversations 
WHERE wasender_chat_id = '120363407417211516@g.us' 
AND id != '007972ed-316b-429c-a353-33b29382a2e5';

-- For group 120363408554664597@g.us: keep 1b3287b9, merge rest
UPDATE whatsapp_messages 
SET conversation_id = '1b3287b9-c228-43f8-beab-aa7d52fa2b16'
WHERE conversation_id IN (
  SELECT id FROM whatsapp_conversations 
  WHERE wasender_chat_id = '120363408554664597@g.us' 
  AND id != '1b3287b9-c228-43f8-beab-aa7d52fa2b16'
);

DELETE FROM whatsapp_conversations 
WHERE wasender_chat_id = '120363408554664597@g.us' 
AND id != '1b3287b9-c228-43f8-beab-aa7d52fa2b16';

-- Add unique constraint on wasender_chat_id + team_id to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_chat_team_unique 
ON whatsapp_conversations (wasender_chat_id, team_id) 
WHERE wasender_chat_id IS NOT NULL;
