-- ALLOW LECTURERS TO MANAGE TIMETABLES FOR THEIR OWN SUBJECTS
-- Keeps admin full control while allowing subject owners to add/update/delete lectures.

ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecturer_Insert_Subject_Timetable" ON public.timetable;
DROP POLICY IF EXISTS "Lecturer_Update_Subject_Timetable" ON public.timetable;
DROP POLICY IF EXISTS "Lecturer_Delete_Subject_Timetable" ON public.timetable;

CREATE POLICY "Lecturer_Insert_Subject_Timetable"
ON public.timetable
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'lecturer')
  AND public.is_lecturer_of_subject(subject_id)
);

CREATE POLICY "Lecturer_Update_Subject_Timetable"
ON public.timetable
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'lecturer')
  AND public.is_lecturer_of_subject(subject_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'lecturer')
  AND public.is_lecturer_of_subject(subject_id)
);

CREATE POLICY "Lecturer_Delete_Subject_Timetable"
ON public.timetable
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'lecturer')
  AND public.is_lecturer_of_subject(subject_id)
);
