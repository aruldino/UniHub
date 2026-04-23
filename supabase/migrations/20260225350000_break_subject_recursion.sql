-- BREAK INFINITE RECURSION IN SUBJECTS/ENROLLMENTS
-- This migration replaces recursive subqueries in RLS policies with SECURITY DEFINER functions.

-- 1. Ensure helper functions are robust (SECURITY DEFINER + search_path)
CREATE OR REPLACE FUNCTION public.is_lecturer_of_subject(_subject_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.subjects WHERE id = _subject_id AND lecturer_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_student_enrolled(_subject_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.enrollments WHERE student_id = auth.uid() AND subject_id = _subject_id);
$$;

-- 2. RE-IMPLEMENT SUBJECTS POLICY
DROP POLICY IF EXISTS "Subjects_Visibility" ON public.subjects;
CREATE POLICY "Subjects_Visibility" ON public.subjects FOR SELECT 
  USING (
    public.is_admin() OR
    lecturer_id = auth.uid() OR
    department_id IS NULL OR 
    department_id = public.get_my_department() OR
    public.is_student_enrolled(id) -- Uses SECURITY DEFINER function to break recursion
  );

-- 3. RE-IMPLEMENT ENROLLMENTS POLICY
DROP POLICY IF EXISTS "Enrollments_Access" ON public.enrollments;
CREATE POLICY "Enrollments_Access" ON public.enrollments FOR SELECT 
  USING (
    student_id = auth.uid() OR 
    public.is_admin() OR
    public.is_lecturer_of_subject(subject_id) -- Uses SECURITY DEFINER function to break recursion
  );
