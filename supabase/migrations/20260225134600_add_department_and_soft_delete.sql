-- Add Department to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS department TEXT;

-- Add soft delete support
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Update RLS for profiles to hide deleted users unless admin
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view active profiles" ON public.profiles
FOR SELECT TO authenticated
USING (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'));
