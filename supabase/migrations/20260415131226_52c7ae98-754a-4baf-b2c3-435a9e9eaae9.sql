
ALTER TABLE team_mailboxes
  ADD COLUMN IF NOT EXISTS sync_mode text NOT NULL DEFAULT 'full_scan',
  ADD COLUMN IF NOT EXISTS full_scan_page_token text,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_message text;

-- Mailboxes with history_id already set should be in incremental mode
UPDATE team_mailboxes SET sync_mode = 'incremental' WHERE history_id IS NOT NULL;
