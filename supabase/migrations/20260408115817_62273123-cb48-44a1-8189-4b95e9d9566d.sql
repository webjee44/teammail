
-- Create contact_tags junction table
CREATE TABLE public.contact_tags (
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

-- RLS: team members can view contact tags
CREATE POLICY "Team members can view contact tags"
ON public.contact_tags
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_tags.contact_id
      AND c.team_id = get_user_team_id(auth.uid())
  )
);

-- RLS: team members can add contact tags
CREATE POLICY "Team members can add contact tags"
ON public.contact_tags
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_tags.contact_id
      AND c.team_id = get_user_team_id(auth.uid())
  )
);

-- RLS: team members can remove contact tags
CREATE POLICY "Team members can remove contact tags"
ON public.contact_tags
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_tags.contact_id
      AND c.team_id = get_user_team_id(auth.uid())
  )
);

-- Index for efficient lookups by tag
CREATE INDEX idx_contact_tags_tag_id ON public.contact_tags(tag_id);
