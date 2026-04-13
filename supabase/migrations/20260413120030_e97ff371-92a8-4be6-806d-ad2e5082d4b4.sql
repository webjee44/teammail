
-- Fix: Remove overly permissive storage SELECT policy on attachments bucket
DROP POLICY IF EXISTS "Authenticated users can read attachments" ON storage.objects;
