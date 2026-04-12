-- ADVANCED RLS ENFORCEMENT & AUDIT MIGRATION

-- 1. Helper Functions for Strict Security
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.get_my_department()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT department_id FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_batch()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT batch FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_lecturer_of_subject(_subject_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.subjects WHERE id = _subject_id AND lecturer_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_student_enrolled(_subject_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.enrollments WHERE student_id = auth.uid() AND subject_id = _subject_id);
$$;

-- 2. RESET POLICIES (Consolidated Clean Slate)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 3. RE-IMPLEMENTING STRICT POLICIES

-- DEPARTMENTS: Admins manage, others view only their own (or all for selection)
CREATE POLICY "Admins full departments" ON public.departments FOR ALL USING (public.is_admin());
CREATE POLICY "Users view departments" ON public.departments FOR SELECT USING (true);

-- PROFILES: Users can always see their own profile. Admins see all. Others see matching dept/batch.
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Lecturer view department profiles" ON public.profiles FOR SELECT 
  USING (
    public.has_role(auth.uid(), 'lecturer') AND 
    department_id = (SELECT p.department_id FROM public.profiles p WHERE p.user_id = auth.uid())
  );
CREATE POLICY "Student view same batch/dept" ON public.profiles FOR SELECT 
  USING (
    department_id = (SELECT p.department_id FROM public.profiles p WHERE p.user_id = auth.uid()) AND 
    batch = (SELECT p.batch FROM public.profiles p WHERE p.user_id = auth.uid())
  );
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());

-- SUBJECTS: Lecturer assigned only, Students within dept/batch only
CREATE POLICY "Admin full subjects" ON public.subjects FOR ALL USING (public.is_admin());
CREATE POLICY "Lecturer subjects access" ON public.subjects FOR SELECT 
  USING (lecturer_id = auth.uid());
CREATE POLICY "Lecturer update subjects" ON public.subjects FOR UPDATE 
  USING (lecturer_id = auth.uid());
CREATE POLICY "Student subjects visibility" ON public.subjects FOR SELECT 
  USING (
    (department_id = public.get_my_department() OR department_id IS NULL) AND 
    (batch = public.get_my_batch() OR batch IS NULL)
  );

-- EXAMS: Linked to subjects
CREATE POLICY "Admin full exams" ON public.exams FOR ALL USING (public.is_admin());
CREATE POLICY "Lecturer manage subject exams" ON public.exams FOR ALL 
  USING (public.is_lecturer_of_subject(subject_id));
CREATE POLICY "Student view published exams" ON public.exams FOR SELECT 
  USING (is_published = true AND (
    EXISTS (SELECT 1 FROM public.enrollments WHERE subject_id = exams.subject_id AND student_id = auth.uid())
  ));

-- EXAM RESULTS
CREATE POLICY "Admin full results" ON public.exam_results FOR ALL USING (public.is_admin());
CREATE POLICY "Lecturer manage subject results" ON public.exam_results FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND public.is_lecturer_of_subject(subject_id)));
CREATE POLICY "Student view own results" ON public.exam_results FOR SELECT 
  USING (student_id = auth.uid() AND EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND is_published = true));

-- FINANCE (Strictly Private)
CREATE POLICY "Admin full finance" ON public.student_fees FOR ALL USING (public.is_admin());
CREATE POLICY "Student view own fees" ON public.student_fees FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Admin full payments" ON public.fee_payments FOR ALL USING (public.is_admin());
CREATE POLICY "Student view own payments" ON public.fee_payments FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.student_fees WHERE id = student_fee_id AND student_id = auth.uid()));

-- MESSAGING / ANNOUNCEMENTS
CREATE POLICY "Admin manage announcements" ON public.announcements FOR ALL USING (public.is_admin());
CREATE POLICY "Lecturer manage announcement" ON public.announcements FOR ALL 
  USING (public.has_role(auth.uid(), 'lecturer'));
CREATE POLICY "User receive announcement" ON public.announcements FOR SELECT 
  USING (
    target_type = 'global' OR 
    (target_type = 'department' AND department_id = public.get_my_department()) OR
    (target_type = 'batch' AND batch = public.get_my_batch()) OR
    (target_type = 'subject' AND public.is_student_enrolled(subject_id))
  );

-- ATTENDANCE
CREATE POLICY "Admin view attendance" ON public.attendance FOR SELECT USING (public.is_admin());
CREATE POLICY "Lecturer manage attendance" ON public.attendance FOR ALL 
  USING (public.is_lecturer_of_subject(subject_id));
CREATE POLICY "Student view own attendance" ON public.attendance FOR SELECT USING (student_id = auth.uid());

-- USER ROLES (The core of security)
CREATE POLICY "User view own role" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin manage all roles" ON public.user_roles FOR ALL USING (public.is_admin());

-- ENROLLMENTS
CREATE POLICY "Admin manage all enrollments" ON public.enrollments FOR ALL USING (public.is_admin());
CREATE POLICY "Lecturer view subject enrollments" ON public.enrollments FOR SELECT 
  USING (public.is_lecturer_of_subject(subject_id));
CREATE POLICY "Student view own enrollments" ON public.enrollments FOR SELECT USING (student_id = auth.uid());

-- ASSIGNMENTS & SUBMISSIONS
CREATE POLICY "Admin full assignments" ON public.assignments FOR ALL USING (public.is_admin());
CREATE POLICY "Lecturer manage assignments" ON public.assignments FOR ALL USING (created_by = auth.uid() OR public.is_lecturer_of_subject(subject_id));
CREATE POLICY "Student view subject assignments" ON public.assignments FOR SELECT USING (public.is_student_enrolled(subject_id));

CREATE POLICY "Student manage submissions" ON public.submissions FOR ALL USING (student_id = auth.uid());
CREATE POLICY "Lecturer view subject submissions" ON public.submissions FOR SELECT USING (EXISTS (SELECT 1 FROM public.assignments WHERE id = assignment_id AND (created_by = auth.uid() OR public.is_lecturer_of_subject(subject_id))));

-- GROUPS & TASKS (Collaboration)
CREATE POLICY "User group access" ON public.groups FOR SELECT USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid()));
CREATE POLICY "User create groups" ON public.groups FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Group admin manage" ON public.groups FOR ALL USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Member view group members" ON public.group_members FOR SELECT USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid()));
CREATE POLICY "Member tasks access" ON public.tasks FOR ALL USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = public.tasks.group_id AND user_id = auth.uid()));

-- ACADEMY EVENTS
CREATE POLICY "Users view events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Admin manage events" ON public.events FOR ALL USING (public.is_admin());
CREATE POLICY "User manage RSVPs" ON public.event_rsvp FOR ALL USING (user_id = auth.uid());

-- NOTIFICATIONS
CREATE POLICY "Users private notifications" ON public.notifications FOR ALL USING (user_id = auth.uid());

-- FINANCE STRUCTURES (Restore)
CREATE POLICY "Admin manage fee structures" ON public.fee_structures FOR ALL USING (public.is_admin());
CREATE POLICY "Users view fee structures" ON public.fee_structures FOR SELECT USING (true);

-- 4. VALIDATION TEST QUERIES (Run these in SQL Editor to verify)
/*
-- TEST 1: Check if student can see other department subjects
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "student_uuid_from_it", "role": "authenticated"}'; -- Mock student in IT
SELECT * FROM public.subjects WHERE department_id = 'finance_dept_uuid'; -- Should return 0 rows

-- TEST 2: Check if lecturer can modify marks for a subject they don't teach
SET request.jwt.claims = '{"sub": "lecturer_a", "role": "authenticated"}';
UPDATE public.exam_results SET marks_obtained = 100 WHERE exam_id IN (SELECT id FROM public.exams WHERE subject_id != 'lecturer_a_subjects'); 
-- Should fail 0 rows updated

-- TEST 3: Cross-Batch Data Check
SET request.jwt.claims = '{"sub": "batch_2023_student", "role": "authenticated"}';
SELECT * FROM public.announcements WHERE target_type = 'batch' AND batch = '2024'; -- Should return 0 rows
*/

-- 5. FINAL AUDIT LOGGING
-- Ensure admins can always audit everything
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin audit all" ON public.activity_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "User insert logs" ON public.activity_logs FOR INSERT WITH CHECK (user_id = auth.uid());
