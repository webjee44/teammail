-- Remove the overly permissive insert policy
DROP POLICY "System can insert notifications" ON public.notifications;

-- The trigger function runs as SECURITY DEFINER and bypasses RLS,
-- so no INSERT policy is needed. No user can insert notifications directly.