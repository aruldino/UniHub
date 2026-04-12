-- RLS FIX & RELAXATION MIGRATION
-- This migration fixes the "Empty Pages" issue by making visibility policies more robust, especially for NULL values.

-- 1. Helper Function Fixes (Ensure they return NULL safely)
CREATE OR REPLACE FUNCTION public.get_my_department()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT department_id FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_batch()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT batch FROM public.profiles WHERE user_id = auth.uid();
$$;

-- 2. REWRITE POLICIES (Focus on Profiles, Subjects, and Enrollments)

-- PROFILES: Users see themselves, Admins see all, others see matching dept/batch OR if same department
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Lecturer view department profiles" ON public.profiles;
DROP POLICY IF EXISTS "Student view same batch/dept" ON public.profiles;

CREATE POLICY "Profiles_Self_Visibility" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Profiles_Admin_Visibility" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Profiles_Department_Visibility" ON public.profiles FOR SELECT 
  USING (
    department_id IS NOT NULL AND 
    department_id = (SELECT p.department_id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- SUBJECTS: Relax student visibility to see all subjects in their department OR subjects with no department
DROP POLICY IF EXISTS "Admin full subjects" ON public.subjects;
DROP POLICY IF EXISTS "Lecturer subjects access" ON public.subjects;
DROP POLICY IF EXISTS "Lecturer update subjects" ON public.subjects;
DROP POLICY IF EXISTS "Student subjects visibility" ON public.subjects;

CREATE POLICY "Subjects_Admin_Access" ON public.subjects FOR ALL USING (public.is_admin());
CREATE POLICY "Subjects_Lecturer_Access" ON public.subjects FOR SELECT USING (lecturer_id = auth.uid());
CREATE POLICY "Subjects_Lecturer_Update" ON public.subjects FOR UPDATE USING (lecturer_id = auth.uid());
CREATE POLICY "Subjects_General_Visibility" ON public.subjects FOR SELECT 
  USING (
    department_id IS NULL OR 
    department_id = public.get_my_department() OR
    EXISTS (SELECT 1 FROM public.enrollments WHERE subject_id = id AND student_id = auth.uid())
  );

-- ENROLLMENTS: Ensure students can always see their own
DROP POLICY IF EXISTS "Admin manage all enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Lecturer view subject enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Student view own enrollments" ON public.enrollments;

CREATE POLICY "Enrollments_Admin_Access" ON public.enrollments FOR ALL USING (public.is_admin());
CREATE POLICY "Enrollments_Lecturer_Visibility" ON public.enrollments FOR SELECT 
  USING (public.is_lecturer_of_subject(subject_id));
CREATE POLICY "Enrollments_Student_Visibility" ON public.enrollments FOR SELECT 
  USING (student_id = auth.uid());

-- EVENTS: Ensure everyone can see all events (no strict batch/dept restriction)
DROP POLICY IF EXISTS "Users view events" ON public.events;
DROP POLICY IF EXISTS "Admin manage events" ON public.events;
CREATE POLICY "Events_Global_Visibility" ON public.events FOR SELECT USING (true);
CREATE POLICY "Events_Admin_Management" ON public.events FOR ALL USING (public.is_admin());

-- GROUPS: Ensure members can see groups
DROP POLICY IF EXISTS "User group access" ON public.groups;
CREATE POLICY "Groups_Member_Visibility" ON public.groups FOR SELECT 
  USING (
    created_by = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid())
  );

-- DEPARTMENTS & BATCHES: Global view for selection
DROP POLICY IF EXISTS "Users view departments" ON public.departments;
CREATE POLICY "Departments_Global_Visibility" ON public.departments FOR SELECT USING (true);

-- 3. STORAGE BUCKET POLICIES (Common source of empty images/files)
-- Ensure 'assignments' bucket is accessible
INSERT INTO storage.buckets (id, name, public) VALUES ('assignments', 'assignments', true) ON CONFLICT DO NOTHING;
DROP POLICY IF EXISTS "Public View Assignments" ON storage.objects;
CREATE POLICY "Public View Assignments" ON storage.objects FOR SELECT USING (bucket_id = 'assignments');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'assignments');
