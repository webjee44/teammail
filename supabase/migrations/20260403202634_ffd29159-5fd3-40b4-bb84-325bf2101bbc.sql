-- Allow users to update their own comments
CREATE POLICY "Users can update own comments"
ON public.comments
FOR UPDATE
USING (user_id = auth.uid());

-- Allow users to delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.comments
FOR DELETE
USING (user_id = auth.uid());