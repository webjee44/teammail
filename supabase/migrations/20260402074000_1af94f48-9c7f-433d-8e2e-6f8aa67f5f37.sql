
UPDATE public.profiles
SET team_id = '60a520df-c0ad-4c2e-9941-f85860f434e2'
WHERE team_id IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'member'::app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id
)
ON CONFLICT (user_id, role) DO NOTHING;
