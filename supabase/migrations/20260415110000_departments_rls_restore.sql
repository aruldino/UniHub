-- Restore write RLS on public.departments after is_admin() CASCADE dropped
-- "Admins full departments" (20260225210000) while leaving SELECT (Departments_Global_Visibility) intact.
-- Result: INSERT/UPDATE/DELETE were denied → "new row violates row-level security policy".

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full departments" ON public.departments;
DROP POLICY IF EXISTS "Only admins can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Anyone can view departments" ON public.departments;
DROP POLICY IF EXISTS "Users view departments" ON public.departments;
DROP POLICY IF EXISTS "departments_insert_admin" ON public.departments;
DROP POLICY IF EXISTS "departments_update_admin" ON public.departments;
DROP POLICY IF EXISTS "departments_delete_admin" ON public.departments;

-- Single broad read policy (avoid duplicate SELECT rules).
DROP POLICY IF EXISTS "Departments_Global_Visibility" ON public.departments;
CREATE POLICY "Departments_Global_Visibility" ON public.departments
  FOR SELECT
  USING (true);

CREATE POLICY "departments_insert_admin" ON public.departments
  FOR INSERT TO authenticated
  WITH CHECK (public.su_is_admin());

CREATE POLICY "departments_update_admin" ON public.departments
  FOR UPDATE TO authenticated
  USING (public.su_is_admin())
  WITH CHECK (public.su_is_admin());

CREATE POLICY "departments_delete_admin" ON public.departments
  FOR DELETE TO authenticated
  USING (public.su_is_admin());
