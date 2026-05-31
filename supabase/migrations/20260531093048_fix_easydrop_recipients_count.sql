UPDATE public.campaigns
SET total_recipients = (
  SELECT count(*) FROM public.campaign_recipients
  WHERE campaign_id = '7721bbd6-62e9-4744-8998-d2fd3eafe2cd'
)
WHERE id = '7721bbd6-62e9-4744-8998-d2fd3eafe2cd';
