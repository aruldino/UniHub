-- FIX: Allow Admins to manage all user profiles
-- Previously, the RLS policy only allowed users to update THEIR OWN profile.
-- These policies use the su_is_admin() helper to bypass recursion.

DROP POLICY IF EXISTS "p_select" ON public.profiles;
DROP POLICY IF EXISTS "p_insert" ON public.profiles;
DROP POLICY IF EXISTS "p_update" ON public.profiles;
DROP POLICY IF EXISTS "p_delete" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p_select" ON public.profiles 
FOR SELECT TO authenticated 
USING (user_id = auth.uid() OR public.su_is_admin());

CREATE POLICY "p_insert" ON public.profiles 
FOR INSERT TO authenticated 
WITH CHECK (public.su_is_admin());

CREATE POLICY "p_update" ON public.profiles 
FOR UPDATE TO authenticated 
USING (user_id = auth.uid() OR public.su_is_admin());

CREATE POLICY "p_delete" ON public.profiles 
FOR DELETE TO authenticated 
USING (public.su_is_admin());
