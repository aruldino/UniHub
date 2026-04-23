-- FIX EXAMS RLS POLICIES
-- This migration restores admin access for managing exams and optimizes visibility.

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view exams" ON public.exams;
DROP POLICY IF EXISTS "Admins manage exams" ON public.exams;
DROP POLICY IF EXISTS "Admin_Full_Control_Exams" ON public.exams;
DROP POLICY IF EXISTS "Lecturers_Visibility_Exams" ON public.exams;

-- 1. Admin Policy: Full control (CRUD)
CREATE POLICY "Admin_Full_Control_Exams"
ON public.exams FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2. General Visibility Policy: 
-- Anyone can view exams for subjects they are enrolled in or teach
CREATE POLICY "General_Visibility_Exams"
ON public.exams FOR SELECT
TO authenticated
USING (
    public.is_admin() OR
    EXISTS (
        SELECT 1 FROM public.subjects s
        WHERE s.id = subject_id AND (
            s.lecturer_id = auth.uid() OR
            s.department_id IS NULL OR
            s.department_id = public.get_my_department() OR
            EXISTS (SELECT 1 FROM public.enrollments e WHERE e.subject_id = s.id AND e.student_id = auth.uid())
        )
    )
);

-- FIX EXAM RESULTS POLICIES
DROP POLICY IF EXISTS "Students see own published results" ON public.exam_results;
DROP POLICY IF EXISTS "Lecturers manage results for their subjects" ON public.exam_results;
DROP POLICY IF EXISTS "Admins full results access" ON public.exam_results;
DROP POLICY IF EXISTS "Admin_Full_Control_Exam_Results" ON public.exam_results;

-- 1. Admin Policy: Full control
CREATE POLICY "Admin_Full_Control_Exam_Results"
ON public.exam_results FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2. Lecturer Policy: Full control for their subjects
CREATE POLICY "Lecturer_Manage_Their_Subjects_Results"
ON public.exam_results FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.exams e
        JOIN public.subjects s ON e.subject_id = s.id
        WHERE e.id = exam_results.exam_id AND s.lecturer_id = auth.uid()
    )
);

-- 3. Student Policy: View only their published results
CREATE POLICY "Student_View_Own_Results"
ON public.exam_results FOR SELECT
TO authenticated
USING (
    student_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND is_published = true)
);
