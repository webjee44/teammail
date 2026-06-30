
-- 1. campaign_events: drop permissive insert (service-role bypasses RLS)
DROP POLICY IF EXISTS "Anyone can insert campaign events" ON public.campaign_events;

-- 2. attachments: add team-scoped UPDATE and DELETE
CREATE POLICY "Team members can update attachments" ON public.attachments
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.id = attachments.message_id AND c.team_id = get_user_team_id(auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.id = attachments.message_id AND c.team_id = get_user_team_id(auth.uid())));

CREATE POLICY "Team members can delete attachments" ON public.attachments
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.id = attachments.message_id AND c.team_id = get_user_team_id(auth.uid())));

-- 3. sync_journal: explicit deny for client writes (service role bypasses RLS)
CREATE POLICY "Deny client inserts on sync_journal" ON public.sync_journal
FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "Deny client updates on sync_journal" ON public.sync_journal
FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny client deletes on sync_journal" ON public.sync_journal
FOR DELETE TO authenticated, anon USING (false);

-- 4. user_roles: only admins (via service role / SECURITY DEFINER) may write; explicit deny for clients
CREATE POLICY "Only admins can insert user roles" ON public.user_roles
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can update user roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete user roles" ON public.user_roles
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. email-assets storage: drop overly broad policies, keep team-scoped ones
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete" ON storage.objects;

-- 6. realtime.messages: require authenticated to use broadcast/presence
DO $$ BEGIN
  EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN others THEN NULL; END $$;
DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime" ON realtime.messages
FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated can send realtime" ON realtime.messages;
CREATE POLICY "Authenticated can send realtime" ON realtime.messages
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Move pg_trgm out of public
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- 8. Lock down SECURITY DEFINER functions in public:
--    revoke from PUBLIC/anon, grant only where needed.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_team_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_sent_conversation_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inbox_list(uuid, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_inbox(text, uuid, boolean, timestamptz, boolean, boolean, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_actionable_count(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.conversation_detail(uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.cleanup_whatsapp_groups() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_conversation_seq_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_mentioned_users() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
