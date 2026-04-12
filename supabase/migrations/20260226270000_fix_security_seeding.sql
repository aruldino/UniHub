-- FIX: Allow Admins to Seed and Manage Security Matrix
-- The previous policy used an undefined or recursive is_admin() function.
-- This update switches to the stable su_is_admin() helper.

DROP POLICY IF EXISTS "Admins manage permissions" ON public.permissions;
DROP POLICY IF EXISTS "Admins manage role_permissions" ON public.role_permissions;

CREATE POLICY "Admins manage permissions" ON public.permissions 
FOR ALL TO authenticated 
USING (public.su_is_admin())
WITH CHECK (public.su_is_admin());

CREATE POLICY "Admins manage role_permissions" ON public.role_permissions 
FOR ALL TO authenticated 
USING (public.su_is_admin())
WITH CHECK (public.su_is_admin());
