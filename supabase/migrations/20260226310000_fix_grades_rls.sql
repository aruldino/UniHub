-- FIX GRADES TABLE RLS
-- This migration ensures the grades table has correct RLS policies using optimized helpers.

-- 1. Enable RLS
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Lecturers can manage grades for assigned subjects" ON public.grades;
DROP POLICY IF EXISTS "Students can view own published grades" ON public.grades;

-- 3. Optimized Policies
-- Use public.is_admin() for faster check and to kill potential recursion

-- LECTURERS & ADMINS: Manage all aspects of grading for assigned subjects
CREATE POLICY "Admins full access grades" ON public.grades 
FOR ALL TO authenticated 
USING (public.is_admin());

CREATE POLICY "Lecturers manage assigned subjects grades" ON public.grades
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.subjects 
        WHERE id = grades.subject_id AND lecturer_id = auth.uid()
    )
);

-- STUDENTS: View published results for subjects they are enrolled in
CREATE POLICY "Students view published grades" ON public.grades
FOR SELECT TO authenticated
USING (
    student_id = auth.uid() AND is_published = true
);

-- REFRESH EXAM RESULTS POLICIES
DROP POLICY IF EXISTS "Admins manage exams" ON public.exams;
CREATE POLICY "Admins manage exams" ON public.exams FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Lecturers manage results for their subjects" ON public.exam_results;
CREATE POLICY "Lecturers manage results for their subjects" ON public.exam_results FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.exams e
        JOIN public.subjects s ON e.subject_id = s.id
        WHERE e.id = exam_results.exam_id AND s.lecturer_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Admins full results access" ON public.exam_results;
CREATE POLICY "Admins full results access" ON public.exam_results FOR ALL TO authenticated USING (public.is_admin());
