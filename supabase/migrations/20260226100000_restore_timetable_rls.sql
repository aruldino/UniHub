-- RESTORE TIMETABLE RLS POLICIES
-- This fixes the error where admins cannot insert or manage timetable slots.

ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full control timetable" ON public.timetable;
DROP POLICY IF EXISTS "Lecturers view assigned timetable" ON public.timetable;
DROP POLICY IF EXISTS "Students view filtered timetable" ON public.timetable;
DROP POLICY IF EXISTS "Admin manage timetable" ON public.timetable;
DROP POLICY IF EXISTS "Anyone can view timetable" ON public.timetable;

-- 1. Admin Policy: Full control (CRUD)
CREATE POLICY "Admin_Full_Control_Timetable"
ON public.timetable FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2. Lecturer Policy: View timetable for subjects they teach
CREATE POLICY "Lecturer_View_Subjects_Timetable"
ON public.timetable FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'lecturer') AND (
        EXISTS (
            SELECT 1 FROM public.subjects 
            WHERE id = subject_id AND lecturer_id = auth.uid()
        )
    )
);

-- 3. Student/Global Policy: View relevant timetable based on department and batch
CREATE POLICY "Student_View_Personal_Timetable"
ON public.timetable FOR SELECT
TO authenticated
USING (
    -- Allow viewing if it belongs to your department OR has no department (Global/Internal)
    (department_id IS NULL OR department_id = public.get_my_department()) AND
    -- Allow viewing if it belongs to your batch OR has no batch
    (batch IS NULL OR batch = public.get_my_batch())
);
