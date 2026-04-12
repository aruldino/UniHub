-- FIX: Ensure PostgREST can detect relationships to Profiles for joined queries

-- 1. Fix Subjects -> Profiles relationship
ALTER TABLE public.subjects 
DROP CONSTRAINT IF EXISTS subjects_lecturer_id_fkey;

ALTER TABLE public.subjects
ADD CONSTRAINT subjects_lecturer_id_fkey 
FOREIGN KEY (lecturer_id) REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;

-- 2. Fix Enrollments -> Profiles relationship
ALTER TABLE public.enrollments
DROP CONSTRAINT IF EXISTS enrollments_student_id_fkey;

ALTER TABLE public.enrollments
ADD CONSTRAINT enrollments_student_id_fkey
FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- 3. Fix Attendance -> Profiles relationship
ALTER TABLE public.attendance
DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;

ALTER TABLE public.attendance
ADD CONSTRAINT attendance_student_id_fkey
FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- 4. Fix Assignments -> Profiles relationship (Created By)
ALTER TABLE public.assignments
DROP CONSTRAINT IF EXISTS assignments_created_by_fkey;

ALTER TABLE public.assignments
ADD CONSTRAINT assignments_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- 5. Fix Submissions -> Profiles relationship
ALTER TABLE public.submissions
DROP CONSTRAINT IF EXISTS submissions_student_id_fkey,
DROP CONSTRAINT IF EXISTS submissions_graded_by_fkey;

ALTER TABLE public.submissions
ADD CONSTRAINT submissions_student_id_fkey
FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

ALTER TABLE public.submissions
ADD CONSTRAINT submissions_graded_by_fkey
FOREIGN KEY (graded_by) REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;
