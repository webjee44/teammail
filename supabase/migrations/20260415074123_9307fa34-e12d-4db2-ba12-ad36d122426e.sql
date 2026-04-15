
-- Delete duplicate attachments, keeping only the oldest per (message_id, storage_path)
DELETE FROM public.attachments
WHERE id NOT IN (
  SELECT DISTINCT ON (message_id, storage_path) id
  FROM public.attachments
  ORDER BY message_id, storage_path, created_at ASC
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX idx_attachments_message_storage_unique
ON public.attachments (message_id, storage_path);
