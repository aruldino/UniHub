-- SECURE FILE SUBMISSION & STORAGE SYSTEM

-- 1. Storage Configuration
-- Create bucket for assignments (if not exists through UI, this documentation helps)
-- Insert into storage.buckets (id, name, public) values ('assignments', 'assignments', false) ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS Policies
-- Students: Can upload to their own folder within a subject
CREATE POLICY "Students can upload submissions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'assignments' AND
    (storage.foldername(name))[1] IS NOT NULL AND -- Subject Folder
    (storage.foldername(name))[2] = auth.uid()::text -- Student ID Folder
);

CREATE POLICY "Students can view own submissions"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'assignments' AND
    (storage.foldername(name))[2] = auth.uid()::text
);

-- Lecturers: Can view all submissions for subjects they teach
CREATE POLICY "Lecturers can view submissions for their subjects"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'assignments' AND
    EXISTS (
        SELECT 1 FROM public.subjects
        WHERE id::text = (storage.foldername(storage.objects.name))[1]
        AND lecturer_id = auth.uid()
    )
);

-- Admins: Full access
CREATE POLICY "Admins full access to assignments"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'assignments' AND
    public.has_role(auth.uid(), 'admin')
);

-- 3. Database Table Enhancements
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS previous_file_urls TEXT[] DEFAULT '{}';

-- 4. RLS for Submissions Table (Ensuring sync with storage)
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can manage own submissions" ON public.submissions;
CREATE POLICY "Students can manage own submissions"
ON public.submissions FOR ALL
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Lecturers can view subject submissions" ON public.submissions;
CREATE POLICY "Lecturers can view subject submissions"
ON public.submissions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.assignments a
        JOIN public.subjects s ON a.subject_id = s.id
        WHERE a.id = submissions.assignment_id
        AND s.lecturer_id = auth.uid()
    )
);
