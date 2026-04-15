-- Unschedule the broken vault-based cron
SELECT cron.unschedule('gmail-sync-every-minute');

-- Recreate with anon key (now accepted by the edge function)
SELECT cron.schedule(
  'gmail-sync-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yrofditplxilqdtcwovq.supabase.co/functions/v1/gmail-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyb2ZkaXRwbHhpbHFkdGN3b3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDgzMjAsImV4cCI6MjA5MDYyNDMyMH0.qzl2Ace7tp2HR17lrna0f4ymhymvE0mcYgKVMFkDDb0"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);