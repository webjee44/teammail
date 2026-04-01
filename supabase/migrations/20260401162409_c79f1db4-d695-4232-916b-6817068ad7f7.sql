ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS is_noise boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS entities jsonb,
  ADD COLUMN IF NOT EXISTS category text;