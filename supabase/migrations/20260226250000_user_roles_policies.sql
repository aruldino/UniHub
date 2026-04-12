-- Add INSERT, UPDATE, and DELETE policies for the user_roles table
-- Admins need the ability to manage user_roles for New Users, Editing roles, and Deleting roles.

CREATE POLICY "ur_insert" ON public.user_roles 
FOR INSERT TO authenticated 
WITH CHECK (public.su_is_admin());

CREATE POLICY "ur_update" ON public.user_roles 
FOR UPDATE TO authenticated 
USING (public.su_is_admin());

CREATE POLICY "ur_delete" ON public.user_roles 
FOR DELETE TO authenticated 
USING (public.su_is_admin());
