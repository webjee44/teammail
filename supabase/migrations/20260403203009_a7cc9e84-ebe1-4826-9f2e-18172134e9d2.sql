-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'mention',
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  triggered_by UUID,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (user_id = auth.uid());

-- Users can update own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
USING (user_id = auth.uid());

-- Service can insert notifications (via trigger, security definer)
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Index for fast lookup
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE is_read = false;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to extract mentions and create notifications
CREATE OR REPLACE FUNCTION public.notify_mentioned_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention TEXT;
  mentioned_user_id UUID;
  conv_subject TEXT;
BEGIN
  -- Extract all @mentions from the comment body
  FOR mention IN
    SELECT (regexp_matches(NEW.body, '@([^\s]+(?:\s[^\s@]+)?)', 'g'))[1]
  LOOP
    -- Find user by full_name or email
    SELECT user_id INTO mentioned_user_id
    FROM public.profiles
    WHERE (full_name IS NOT NULL AND full_name = mention)
       OR (email IS NOT NULL AND email = mention)
    LIMIT 1;

    -- Don't notify the author themselves
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
      -- Get conversation subject
      SELECT subject INTO conv_subject
      FROM public.conversations
      WHERE id = NEW.conversation_id;

      INSERT INTO public.notifications (user_id, type, conversation_id, comment_id, triggered_by, message)
      VALUES (
        mentioned_user_id,
        'mention',
        NEW.conversation_id,
        NEW.id,
        NEW.user_id,
        'Vous a mentionné dans "' || COALESCE(conv_subject, '(sans sujet)') || '"'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger on comment insert
CREATE TRIGGER on_comment_mention
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_mentioned_users();