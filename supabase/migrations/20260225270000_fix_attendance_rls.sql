-- FIX ATTENDANCE RLS FOR ADMINS
DROP POLICY IF EXISTS "Admin view attendance" ON public.attendance;

CREATE POLICY "Admin manage attendance" ON public.attendance FOR ALL 
TO authenticated 
USING (public.is_admin());
