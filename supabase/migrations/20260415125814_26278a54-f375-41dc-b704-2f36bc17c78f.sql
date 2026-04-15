-- Unschedule the broken cron job that uses anon key
SELECT cron.unschedule(6);

-- Recreate with the service_role key
SELECT cron.schedule(
  'gmail-sync-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yrofditplxilqdtcwovq.supabase.co/functions/v1/gmail-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);