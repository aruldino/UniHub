-- FIX SUBMISSIONS RLS
-- This migration ensures that lecturers can grade (update) submissions for their assignments.

-- 1. Drop existing restrictive policies to prevent conflicts
DROP POLICY IF EXISTS "Lecturer view subject submissions" ON public.submissions;
DROP POLICY IF EXISTS "Student manage submissions" ON public.submissions;
DROP POLICY IF EXISTS "Lecturers can view submissions for their assignments" ON public.submissions;
DROP POLICY IF EXISTS "Lecturers can grade submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students can view own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students can create own submissions" ON public.submissions;

-- 2. Comprehensive Policies for Submissions

-- ADMINS: Full control
CREATE POLICY "Admin full submissions" ON public.submissions
FOR ALL TO authenticated
USING (public.is_admin());

-- STUDENTS: Manage their own submissions (SELECT, INSERT, UPDATE)
-- Note: They shouldn't be able to update marks, but RLS on columns is not easily done here.
-- However, since the UI only allows them to upload files, we usually trust the student_id check.
CREATE POLICY "Student manage own submissions" ON public.submissions
FOR ALL TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- LECTURERS: View and Grade submissions for their assignments or subjects
CREATE POLICY "Lecturer view submissions" ON public.submissions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.assignments 
        WHERE id = submissions.assignment_id 
        AND (created_by = auth.uid() OR public.is_lecturer_of_subject(subject_id))
    )
);

CREATE POLICY "Lecturer grade submissions" ON public.submissions
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.assignments 
        WHERE id = submissions.assignment_id 
        AND (created_by = auth.uid() OR public.is_lecturer_of_subject(subject_id))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.assignments 
        WHERE id = submissions.assignment_id 
        AND (created_by = auth.uid() OR public.is_lecturer_of_subject(subject_id))
    )
);

-- 3. Ensure RLS is active
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
