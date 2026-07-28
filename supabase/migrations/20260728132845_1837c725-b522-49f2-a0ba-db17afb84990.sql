
-- 1. Remove universal auth policies on messages
DROP POLICY IF EXISTS "Authenticated can send realtime" ON public.messages;
DROP POLICY IF EXISTS "Authenticated can use realtime" ON public.messages;

-- 2. Add explicit team-scoped UPDATE policy for email-assets storage
DROP POLICY IF EXISTS "Team members can update own email assets" ON storage.objects;
CREATE POLICY "Team members can update own email assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'email-assets'
  AND (storage.foldername(name))[1] = (public.get_user_team_id(auth.uid()))::text
)
WITH CHECK (
  bucket_id = 'email-assets'
  AND (storage.foldername(name))[1] = (public.get_user_team_id(auth.uid()))::text
);
