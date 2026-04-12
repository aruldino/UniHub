-- RESTRICT STUDENT SUBJECT ACCESS TO ENROLLMENTS ONLY
-- Students should only be able to view subjects they are explicitly enrolled in.

DROP POLICY IF EXISTS "Student view relevant subjects" ON public.subjects;

CREATE POLICY "Student view enrolled subjects only" ON public.subjects
FOR SELECT 
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'lecturer') OR
    EXISTS (
        SELECT 1 FROM public.enrollments 
        WHERE enrollments.subject_id = public.subjects.id 
        AND enrollments.student_id = auth.uid()
    )
);

-- Informational log
SELECT 'Subjects RLS updated: Students now restricted to enrolled courses.' as status;
