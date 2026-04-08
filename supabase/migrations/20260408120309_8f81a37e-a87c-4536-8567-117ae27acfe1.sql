
-- Campaign events table for tracking opens and clicks
CREATE TABLE public.campaign_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.campaign_recipients(id) ON DELETE SET NULL,
  event_type text NOT NULL, -- 'open' or 'click'
  link_url text, -- only for click events
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_campaign_events_campaign_id ON public.campaign_events(campaign_id);
CREATE INDEX idx_campaign_events_recipient_id ON public.campaign_events(recipient_id);
CREATE INDEX idx_campaign_events_type ON public.campaign_events(event_type);

-- Enable RLS
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

-- Anyone can INSERT (tracking pixel/redirect - no auth)
CREATE POLICY "Anyone can insert campaign events"
ON public.campaign_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Team members can view events for their campaigns
CREATE POLICY "Team members can view campaign events"
ON public.campaign_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_events.campaign_id
      AND c.team_id = get_user_team_id(auth.uid())
  )
);

-- Add tracking columns to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;

-- Add tracking timestamps to campaign_recipients
ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS opened_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS clicked_at timestamp with time zone;
