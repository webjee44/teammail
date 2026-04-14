-- Fix email-assets bucket: add team-based ownership checks
-- First drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload email assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete email assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view email assets" ON storage.objects;

-- Recreate with team-scoped ownership (using team_id as path prefix)
CREATE POLICY "Team members can upload email assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'email-assets'
  AND (storage.foldername(name))[1] = get_user_team_id(auth.uid())::text
);

CREATE POLICY "Team members can delete own email assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'email-assets'
  AND (storage.foldername(name))[1] = get_user_team_id(auth.uid())::text
);

CREATE POLICY "Email assets are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'email-assets');