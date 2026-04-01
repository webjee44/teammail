
-- 1. Make attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'attachments';

-- 2. Drop insecure storage policies
DROP POLICY IF EXISTS "Public read access on attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;

-- 3. Create team-scoped SELECT policy for attachments
CREATE POLICY "Team members can read attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments' AND
  EXISTS (
    SELECT 1 FROM public.attachments a
    JOIN public.messages m ON m.id = a.message_id
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE a.storage_path = name
      AND c.team_id = get_user_team_id(auth.uid())
  )
);

-- 4. Create team-scoped INSERT policy for attachments
CREATE POLICY "Team members can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments' AND
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.team_id = get_user_team_id(auth.uid())
      AND c.id::text = (string_to_array(name, '/'))[1]
  )
);

-- 5. Fix profile update policy to prevent team_id escalation
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() AND
  team_id IS NOT DISTINCT FROM (SELECT p.team_id FROM public.profiles p WHERE p.user_id = auth.uid())
);
