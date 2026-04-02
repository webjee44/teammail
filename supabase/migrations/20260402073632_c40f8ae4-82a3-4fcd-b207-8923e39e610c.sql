
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team_id uuid;
BEGIN
  -- Get the CloudVapor team id (fallback to first team if needed)
  SELECT id INTO _team_id FROM public.teams WHERE name = 'CloudVapor' LIMIT 1;
  IF _team_id IS NULL THEN
    SELECT id INTO _team_id FROM public.teams ORDER BY created_at LIMIT 1;
  END IF;

  -- Create profile with team assignment
  INSERT INTO public.profiles (user_id, email, full_name, avatar_url, team_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    _team_id
  );

  -- Assign default member role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
