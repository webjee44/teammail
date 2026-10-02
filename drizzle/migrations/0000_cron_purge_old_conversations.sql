-- lovable-cron-fallback-reviewed: one-time bounded purge of 3269 old conversations in 500-row batches; job self-unschedules when nothing remains, so it runs at most ~7 times
SELECT cron.schedule(
  'purge-old-conversations',
  '*/5 * * * *',
  $$
  WITH d AS (
    DELETE FROM public.conversations
    WHERE id IN (
      SELECT id FROM public.conversations
      WHERE last_message_at < now() - interval '24 months'
      LIMIT 500
    )
    RETURNING 1
  )
  SELECT cron.unschedule('purge-old-conversations')
  WHERE NOT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE last_message_at < now() - interval '24 months'
  );
  $$
);