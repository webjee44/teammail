-- Add address and business fields to contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS street2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS salesperson text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Unique index for sync dedup
CREATE UNIQUE INDEX IF NOT EXISTS contacts_team_external_id_idx 
  ON public.contacts (team_id, external_id) 
  WHERE external_id IS NOT NULL;

-- Migrate existing custom_fields data into new columns
UPDATE public.contacts SET
  street = custom_fields->>'street',
  street2 = custom_fields->>'street2',
  city = custom_fields->>'city',
  zip = custom_fields->>'zip',
  country = custom_fields->>'country',
  salesperson = custom_fields->>'salesperson'
WHERE custom_fields IS NOT NULL 
  AND custom_fields != '{}'::jsonb
  AND street IS NULL;