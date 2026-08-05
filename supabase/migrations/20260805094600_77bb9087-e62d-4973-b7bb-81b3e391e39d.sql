-- comments: restrict to authenticated role
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users can update own comments"
ON public.comments FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own comments"
ON public.comments FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- notifications: restrict to authenticated role
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- attachments: make storage_path / message_id immutable for non-privileged roles
CREATE OR REPLACE FUNCTION public.prevent_attachment_path_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR NEW.message_id IS DISTINCT FROM OLD.message_id
     OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes THEN
    RAISE EXCEPTION 'storage_path, message_id and size_bytes are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attachments_immutable_path ON public.attachments;
CREATE TRIGGER trg_attachments_immutable_path
BEFORE UPDATE ON public.attachments
FOR EACH ROW EXECUTE FUNCTION public.prevent_attachment_path_change();

-- campaign_events: writes are backend-only (service role); make deny explicit
REVOKE INSERT, UPDATE, DELETE ON public.campaign_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.campaign_events FROM anon;
GRANT ALL ON public.campaign_events TO service_role;