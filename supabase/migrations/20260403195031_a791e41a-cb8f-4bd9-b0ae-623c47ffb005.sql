CREATE POLICY "Authenticated users can read attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'attachments');