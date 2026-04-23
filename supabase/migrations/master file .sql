
-- FILE: 20260225060229_f3119e9c-3536-4451-bf27-9d1c5c538517.sql

-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'lecturer', 'student');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  UNIQUE(user_id, role)
);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  lecturer_id UUID REFERENCES auth.users(id),
  credits INTEGER NOT NULL DEFAULT 3,
  semester TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Timetable
CREATE TABLE public.timetable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Student enrollments
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, subject_id)
);

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subject_id, student_id, date)
);

-- Assignments
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  max_marks INTEGER NOT NULL DEFAULT 100,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Submissions
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT,
  file_name TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_late BOOLEAN NOT NULL DEFAULT false,
  marks INTEGER,
  feedback TEXT,
  graded_by UUID REFERENCES auth.users(id),
  graded_at TIMESTAMPTZ,
  UNIQUE(assignment_id, student_id)
);

-- Study Groups
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Group Members
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Tasks (Kanban)
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  assigned_to UUID REFERENCES auth.users(id),
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event RSVP
CREATE TABLE public.event_rsvp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity Logs
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile and role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== RLS POLICIES ==========

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- User Roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Subjects
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage subjects" ON public.subjects FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Lecturers can update their subjects" ON public.subjects FOR UPDATE TO authenticated USING (auth.uid() = lecturer_id);

-- Timetable
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view timetable" ON public.timetable FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage timetable" ON public.timetable FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Enrollments
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own enrollments" ON public.enrollments FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Lecturers can view enrollments for their subjects" ON public.enrollments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subjects WHERE subjects.id = subject_id AND subjects.lecturer_id = auth.uid()));
CREATE POLICY "Admins can manage enrollments" ON public.enrollments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own attendance" ON public.attendance FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Lecturers can manage attendance for their subjects" ON public.attendance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subjects WHERE subjects.id = subject_id AND subjects.lecturer_id = auth.uid()));
CREATE POLICY "Admins can view all attendance" ON public.attendance FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Assignments
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view assignments" ON public.assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecturers can manage their assignments" ON public.assignments FOR ALL TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Admins can manage all assignments" ON public.assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Submissions
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own submissions" ON public.submissions FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Students can create own submissions" ON public.submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Lecturers can view submissions for their assignments" ON public.submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assignments WHERE assignments.id = assignment_id AND assignments.created_by = auth.uid()));
CREATE POLICY "Lecturers can grade submissions" ON public.submissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assignments WHERE assignments.id = assignment_id AND assignments.created_by = auth.uid()));

-- Groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view their groups" ON public.groups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = id AND group_members.user_id = auth.uid()));
CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Group admins can update" ON public.groups FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = id AND group_members.user_id = auth.uid() AND group_members.role = 'admin'));

-- Group Members
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view group members" ON public.group_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid()));
CREATE POLICY "Group admins can manage members" ON public.group_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'));

-- Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members can view tasks" ON public.tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = group_id AND group_members.user_id = auth.uid()));
CREATE POLICY "Group members can manage tasks" ON public.tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_members.group_id = group_id AND group_members.user_id = auth.uid()));

-- Events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage events" ON public.events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Event RSVP
ALTER TABLE public.event_rsvp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view RSVPs" ON public.event_rsvp FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own RSVP" ON public.event_rsvp FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Activity Logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- FILE: 20260225134500_fix_profile_relationships.sql
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


-- FILE: 20260225134600_add_department_and_soft_delete.sql
-- Add Department to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS department TEXT;

-- Add soft delete support
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Update RLS for profiles to hide deleted users unless admin
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view active profiles" ON public.profiles
FOR SELECT TO authenticated
USING (deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'));


-- FILE: 20260225140000_enterprise_schema.sql
-- ENTERPRISE SCHEMA (Smart Academic Management System)

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Update Profiles with Department and Enterprise Fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS batch TEXT, -- e.g. '2023', '2024'
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Update Subjects Table
-- Ensure department_id and batch exist on subjects for enterprise filtering
ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS batch TEXT; -- Link subjects to specific batches

-- 4. Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 5. STRICT RLS POLICIES

-- DEPARTMENTS
CREATE POLICY "Anyone can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- PROFILES
DROP POLICY IF EXISTS "Users can view active profiles" ON public.profiles;
CREATE POLICY "Users can view relevant profiles" ON public.profiles 
FOR SELECT TO authenticated 
USING (
    public.has_role(auth.uid(), 'admin') OR 
    (deleted_at IS NULL AND status = 'active')
);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- SUBJECTS
DROP POLICY IF EXISTS "Anyone can view active subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "Lecturers can update their subjects" ON public.subjects;

CREATE POLICY "Admin full access subjects" ON public.subjects FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Lecturer view assigned subjects" ON public.subjects 
FOR SELECT USING (lecturer_id = auth.uid());

CREATE POLICY "Student view relevant subjects" ON public.subjects
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.user_id = auth.uid() 
        AND (profiles.department_id = subjects.department_id OR subjects.department_id IS NULL)
        AND (profiles.batch = subjects.batch OR subjects.batch IS NULL)
    )
);

-- ENROLLMENTS (Ensure sync with enterprise structure)
DROP POLICY IF EXISTS "Admins can manage enrollments" ON public.enrollments;
CREATE POLICY "Admin full access enrollments" ON public.enrollments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ATTENDANCE
DROP POLICY IF EXISTS "Lecturers can manage attendance for their subjects" ON public.attendance;
CREATE POLICY "Lecturer manage attendance for assigned" ON public.attendance
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.subjects WHERE id = subject_id AND lecturer_id = auth.uid())
);

-- 6. Trigger Update for New Users (Capture Department_id and Batch)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role, department_id, batch, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student'),
    (NEW.raw_user_meta_data->>'department_id')::uuid,
    NEW.raw_user_meta_data->>'batch',
    COALESCE(NEW.raw_user_meta_data->>'status', 'active')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );
  
  RETURN NEW;
END;
$$;


-- FILE: 20260225150000_grading_system.sql
-- GRADING & GPA SYSTEM

-- 1. Create Grades Table
CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    grade_point NUMERIC(3,2) CHECK (grade_point >= 0 AND grade_point <= 4.0),
    letter_grade TEXT CHECK (letter_grade IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F')),
    marks_obtained NUMERIC(5,2),
    max_marks NUMERIC(5,2) DEFAULT 100,
    semester TEXT NOT NULL, -- e.g. 'Semester 1', 'Spring 2024'
    academic_year TEXT NOT NULL, -- e.g. '2023-2024'
    is_published BOOLEAN DEFAULT false,
    remarks TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, subject_id, semester)
);

-- 2. GPA Calculation View
CREATE OR REPLACE VIEW public.student_semester_gpa AS
SELECT 
    grades.student_id,
    grades.semester,
    grades.academic_year,
    SUM(grades.grade_point * subjects.credits) / SUM(subjects.credits) as sgpa,
    SUM(subjects.credits) as total_credits
FROM 
    public.grades
JOIN 
    public.subjects ON grades.subject_id = subjects.id
WHERE 
    grades.is_published = true
GROUP BY 
    grades.student_id, grades.semester, grades.academic_year;

-- 3. RLS POLICIES FOR GRADES
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- Lecturers can manage grades for their assigned subjects
CREATE POLICY "Lecturers can manage grades for assigned subjects" 
ON public.grades
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.subjects 
        WHERE id = subject_id AND lecturer_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
);

-- Students can view their own published grades
CREATE POLICY "Students can view own published grades" 
ON public.grades
FOR SELECT 
TO authenticated
USING (
    (student_id = auth.uid() AND is_published = true) OR 
    public.has_role(auth.uid(), 'admin')
);

-- 4. Audit Log Function for Grading
CREATE OR REPLACE FUNCTION public.log_grade_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
        auth.uid(),
        'GRADE_UPDATE',
        'grade',
        NEW.id,
        jsonb_build_object(
            'student_id', NEW.student_id,
            'subject_id', NEW.subject_id,
            'grade', NEW.letter_grade,
            'point', NEW.grade_point
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_grade_updated
    AFTER INSERT OR UPDATE ON public.grades
    FOR EACH ROW EXECUTE FUNCTION public.log_grade_change();


-- FILE: 20260225160000_timetable_system.sql
-- ENTERPRISE TIMETABLE & SCHEDULING SYSTEM

-- 1. Enable Extension for Conflict Prevention (Exclusion Constraints)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Enhance Timetable Table
ALTER TABLE public.timetable 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS batch TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Add Conflict Prevention (Exclusion Constraint)
-- This prevents overlapping times for the same ROOM on the same DAY
ALTER TABLE public.timetable 
ADD CONSTRAINT room_time_conflict EXCLUDE USING gist (
    room WITH =,
    day_of_week WITH =,
    tsrange(
        ('1970-01-01'::date + start_time)::timestamp,
        ('1970-01-01'::date + end_time)::timestamp
    ) WITH &&
);

-- This prevents overlapping times for the same BATCH + DEPT on the same DAY
-- (Students can't be in two places at once)
ALTER TABLE public.timetable 
ADD CONSTRAINT batch_time_conflict EXCLUDE USING gist (
    batch WITH =,
    department_id WITH =,
    day_of_week WITH =,
    tsrange(
        ('1970-01-01'::date + start_time)::timestamp,
        ('1970-01-01'::date + end_time)::timestamp
    ) WITH &&
);

-- 4. RLS POLICIES FOR TIMETABLE
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view timetable" ON public.timetable;
DROP POLICY IF EXISTS "Admins can manage timetable" ON public.timetable;

-- Admin: Full Control
CREATE POLICY "Admins full control timetable" 
ON public.timetable FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Lecturers: View assigned subjects' timetable
CREATE POLICY "Lecturers view assigned timetable" 
ON public.timetable FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.subjects 
        WHERE id = subject_id AND lecturer_id = auth.uid()
    )
);

-- Students: View relevant filtered timetable
CREATE POLICY "Students view filtered timetable" 
ON public.timetable FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND (profiles.department_id = timetable.department_id OR timetable.department_id IS NULL)
        AND (profiles.batch = timetable.batch OR timetable.batch IS NULL)
    )
);

-- 5. Trigger for updated_at
CREATE TRIGGER update_timetable_updated_at 
BEFORE UPDATE ON public.timetable 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- FILE: 20260225170000_storage_system.sql
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


-- FILE: 20260225180000_exam_system.sql
-- EXAM & RESULTS MANAGEMENT SYSTEM

-- 1. Create Exams Table
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    exam_type TEXT NOT NULL CHECK (exam_type IN ('Midterm', 'Final', 'Quiz', 'Lab', 'Internal')),
    exam_date TIMESTAMPTZ NOT NULL,
    max_marks INTEGER DEFAULT 100,
    is_published BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Exam Results Table
CREATE TABLE IF NOT EXISTS public.exam_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    marks_obtained DECIMAL(5,2),
    grade_point DECIMAL(3,2),
    letter_grade TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(exam_id, student_id)
);

-- 3. Automatic Grade Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_exam_grade()
RETURNS TRIGGER AS $$
DECLARE
    max_m INTEGER;
    perc DECIMAL(5,2);
BEGIN
    SELECT max_marks INTO max_m FROM public.exams WHERE id = NEW.exam_id;
    
    perc := (NEW.marks_obtained / max_m) * 100;
    
    IF perc >= 85 THEN 
        NEW.letter_grade := 'A+'; NEW.grade_point := 4.00;
    ELSIF perc >= 75 THEN 
        NEW.letter_grade := 'A'; NEW.grade_point := 3.75;
    ELSIF perc >= 65 THEN 
        NEW.letter_grade := 'B'; NEW.grade_point := 3.00;
    ELSIF perc >= 50 THEN 
        NEW.letter_grade := 'C'; NEW.grade_point := 2.00;
    ELSE 
        NEW.letter_grade := 'F'; NEW.grade_point := 0.00;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_calculate_exam_grade
BEFORE INSERT OR UPDATE OF marks_obtained ON public.exam_results
FOR EACH ROW EXECUTE FUNCTION public.calculate_exam_grade();

-- 4. Result Locking Logic
CREATE OR REPLACE FUNCTION public.check_exam_lock()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.exams WHERE id = NEW.exam_id AND is_locked = true) THEN
        RAISE EXCEPTION 'This exam result is locked and cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_exam_lock
BEFORE UPDATE OR DELETE ON public.exam_results
FOR EACH ROW EXECUTE FUNCTION public.check_exam_lock();

-- 5. RLS POLICIES
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- Exams Policies
CREATE POLICY "Anyone can view exams" ON public.exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage exams" ON public.exams FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Exam Results Policies
CREATE POLICY "Students see own published results" 
ON public.exam_results FOR SELECT 
TO authenticated 
USING (
    student_id = auth.uid() AND 
    EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND is_published = true)
);

CREATE POLICY "Lecturers manage results for their subjects" 
ON public.exam_results FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.exams e
        JOIN public.subjects s ON e.subject_id = s.id
        WHERE e.id = exam_results.exam_id AND s.lecturer_id = auth.uid()
    )
);

CREATE POLICY "Admins full results access" ON public.exam_results FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. Trigger for updated_at
CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exam_results_updated_at BEFORE UPDATE ON public.exam_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- FILE: 20260225190000_finance_system.sql
-- FINANCE & FEE MANAGEMENT SYSTEM

-- 1. Create Fee Structures (Templates for batches/departments)
CREATE TABLE IF NOT EXISTS public.fee_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    total_amount DECIMAL(12,2) NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    batch TEXT,
    academic_year TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Student Fee Assignments (Actual balance per student)
CREATE TABLE IF NOT EXISTS public.student_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    fee_structure_id UUID REFERENCES public.fee_structures(id) ON DELETE CASCADE NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL, -- Copied from structure but can be adjusted (scholarships etc)
    paid_amount DECIMAL(12,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, fee_structure_id)
);

-- 3. Payment Transactions (Installments)
CREATE TABLE IF NOT EXISTS public.fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_fee_id UUID REFERENCES public.student_fees(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'card', 'online')),
    transaction_id TEXT,
    payment_date TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    received_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Automated Status Management Function
CREATE OR REPLACE FUNCTION public.update_fee_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.student_fees
    SET 
        paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM public.fee_payments WHERE student_fee_id = NEW.student_fee_id),
        status = CASE 
            WHEN (SELECT COALESCE(SUM(amount), 0) FROM public.fee_payments WHERE student_fee_id = NEW.student_fee_id) >= total_amount THEN 'paid'
            WHEN (SELECT COALESCE(SUM(amount), 0) FROM public.fee_payments WHERE student_fee_id = NEW.student_fee_id) > 0 THEN 'partial'
            ELSE 'unpaid'
        END,
        updated_at = now()
    WHERE id = NEW.student_fee_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_fee_status
AFTER INSERT OR UPDATE OR DELETE ON public.fee_payments
FOR EACH ROW EXECUTE FUNCTION public.update_fee_status();

-- 5. RLS POLICIES
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- Admins: Total Control
CREATE POLICY "Admins full control fee structures" ON public.fee_structures FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full control student fees" ON public.student_fees FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full control fee payments" ON public.fee_payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Students: View Only Own
CREATE POLICY "Students view own fees" 
ON public.student_fees FOR SELECT 
TO authenticated 
USING (student_id = auth.uid());

CREATE POLICY "Students view own payments" 
ON public.fee_payments FOR SELECT 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.student_fees WHERE id = student_fee_id AND student_id = auth.uid()));

CREATE POLICY "Students view relevant structures" 
ON public.fee_structures FOR SELECT 
TO authenticated 
USING (true); -- General fee info is public inside academy

-- 6. Trigger for updated_at
CREATE TRIGGER update_fee_structures_updated_at BEFORE UPDATE ON public.fee_structures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_student_fees_updated_at BEFORE UPDATE ON public.student_fees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- FILE: 20260225200000_messaging_system.sql
-- MESSAGING & ANNOUNCEMENT SYSTEM

-- 1. Announcements Table (Broadcasts)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('global', 'subject', 'department', 'batch')),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    batch TEXT,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Announcement Tracking (Who read what)
CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    read_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(announcement_id, user_id)
);

-- 3. Direct Messages (1-to-1 or group context)
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Null for group-context messages if needed
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE, -- Context: "Lecturer to subject students"
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- 5. RLS POLICIES
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Announcements: Anyone can read relevant announcements
CREATE POLICY "Users can view relevant announcements" 
ON public.announcements FOR SELECT 
TO authenticated 
USING (
    target_type = 'global' OR
    (target_type = 'subject' AND EXISTS (SELECT 1 FROM public.enrollments WHERE subject_id = announcements.subject_id AND student_id = auth.uid())) OR
    (target_type = 'subject' AND EXISTS (SELECT 1 FROM public.subjects WHERE id = announcements.subject_id AND lecturer_id = auth.uid())) OR
    (public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins and Lecturers manage announcements" 
ON public.announcements FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'lecturer'));

-- Announcement Reads: Users manage own read status
CREATE POLICY "Users manage own announcement reads" 
ON public.announcement_reads FOR ALL 
TO authenticated 
USING (user_id = auth.uid());

-- Direct Messages: Private access
CREATE POLICY "Users view own messages" 
ON public.direct_messages FOR SELECT 
TO authenticated 
USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR 
    (subject_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.enrollments WHERE subject_id = direct_messages.subject_id AND student_id = auth.uid()
    ))
);

CREATE POLICY "Users send messages" 
ON public.direct_messages FOR INSERT 
TO authenticated 
WITH CHECK (sender_id = auth.uid());

-- 6. Trigger for updated_at
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- FILE: 20260225210000_advanced_rls.sql
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


-- FILE: 20260225220000_audit_logging.sql
-- ENTERPRISE AUDIT LOGGING SYSTEM

-- 1. Create Advanced Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Prevent tampering (No updates or deletes allowed on logs)
CREATE OR REPLACE FUNCTION public.block_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are tamper-proof and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_block_audit_mutation
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

-- 3. Advanced Audit Trigger Function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT;
    v_user_role TEXT;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
BEGIN
    -- Capture user context from profiles/user_roles
    SELECT email INTO v_user_email FROM public.profiles WHERE user_id = v_user_id;
    SELECT role::text INTO v_user_role FROM public.user_roles WHERE user_id = v_user_id;

    IF (TG_OP = 'UPDATE') THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
    ELSIF (TG_OP = 'DELETE') THEN
        v_old := to_jsonb(OLD);
    ELSIF (TG_OP = 'INSERT') THEN
        v_new := to_jsonb(NEW);
    END IF;

    INSERT INTO public.audit_logs (
        user_id, user_email, user_role,
        action, table_name, record_id,
        old_data, new_data,
        ip_address, user_agent
    ) VALUES (
        v_user_id, v_user_email, v_user_role,
        TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id),
        v_old, v_new,
        inet_client_addr()::text,
        NULL -- User agent is hard to get directly in SQL without custom headers
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply Triggers to Critical Tables
-- Profiles
CREATE TRIGGER audit_profiles_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Subjects
CREATE TRIGGER audit_subjects_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Exams
CREATE TRIGGER audit_exams_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.exams
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Exam Results
CREATE TRIGGER audit_results_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.exam_results
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Finance
CREATE TRIGGER audit_fees_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.student_fees
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 5. RLS POLICIES
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only view audit logs" 
ON public.audit_logs FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Note: No INSERT policy needed for users because trigger runs as SECURITY DEFINER


-- FILE: 20260225230000_analytics_system.sql
-- ANALYTICS & INSIGHTS SYSTEM

-- 1. VIEW: Student Performance Trends (Average grades per subject)
CREATE OR REPLACE VIEW public.view_subject_performance AS
SELECT 
    s.id as subject_id,
    s.name as subject_name,
    AVG(er.marks_obtained) as avg_marks,
    AVG(er.grade_point) as avg_grade_point,
    COUNT(er.id) as total_results
FROM public.subjects s
JOIN public.exams e ON e.subject_id = s.id
JOIN public.exam_results er ON er.exam_id = e.id
GROUP BY s.id, s.name;

-- 2. VIEW: Attendance Rate by Subject
CREATE OR REPLACE VIEW public.view_attendance_stats AS
SELECT 
    s.id as subject_id,
    s.name as subject_name,
    COUNT(*) filter (where a.status = 'present') * 100.0 / COUNT(*) as attendance_rate,
    COUNT(*) as total_records
FROM public.subjects s
JOIN public.attendance a ON a.subject_id = s.id
GROUP BY s.id, s.name;

-- 3. VIEW: Lecturer Workload (Subjects, Assignments, Students)
CREATE OR REPLACE VIEW public.view_lecturer_workload AS
SELECT 
    p.user_id as lecturer_id,
    p.full_name as lecturer_name,
    COUNT(DISTINCT s.id) as subjects_count,
    COUNT(DISTINCT a.id) as assignments_count,
    COUNT(DISTINCT e.student_id) as total_students
FROM public.profiles p
LEFT JOIN public.subjects s ON s.lecturer_id = p.user_id
LEFT JOIN public.assignments a ON a.subject_id = s.id
LEFT JOIN public.enrollments e ON e.subject_id = s.id
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'lecturer')
GROUP BY p.user_id, p.full_name;

-- 4. VIEW: Financial Collection Summary (Monthly)
CREATE OR REPLACE VIEW public.view_monthly_finance AS
SELECT 
    to_char(payment_date, 'Mon YYYY') as month,
    SUM(amount) as total_collected,
    COUNT(*) as transaction_count
FROM public.fee_payments
GROUP BY to_char(payment_date, 'Mon YYYY'), date_trunc('month', payment_date)
ORDER BY date_trunc('month', payment_date) DESC;

-- RLS for Views (Ensuring security)
ALTER VIEW public.view_subject_performance SET (security_invoker = on);
ALTER VIEW public.view_attendance_stats SET (security_invoker = on);
ALTER VIEW public.view_lecturer_workload SET (security_invoker = on);
ALTER VIEW public.view_monthly_finance SET (security_invoker = on);


-- FILE: 20260225240000_dynamic_permissions.sql
-- DYNAMIC PERMISSION-BASED ACCESS CONTROL (RBAC)

-- 1. Permissions Table
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g. 'manage_users', 'view_finance', 'post_announcements'
    description TEXT,
    module TEXT NOT NULL, -- e.g. 'users', 'finance', 'academic'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Role-Permissions Mapping
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role public.app_role NOT NULL,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(role, permission_id)
);

-- 3. Security Definer Function to Check Permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.name = _permission_name
  );
END;
$$;

-- 4. Seed Default Permissions
INSERT INTO public.permissions (name, description, module) VALUES
('manage:users', 'Create, update and delete users', 'admin'),
('manage:departments', 'Manage institutional departments', 'admin'),
('view:audit_logs', 'View system security logs', 'admin'),
('view:analytics', 'Access high-level institutional reports', 'admin'),
('manage:finance', 'Bursar level access to fees and payments', 'finance'),
('view:finance', 'View own or student financial records', 'finance'),
('manage:subjects', 'Create and modify course structures', 'academic'),
('manage:grading', 'Enter and modify student results', 'academic'),
('manage:announcements', 'Dispatch academy-wide notices', 'communication'),
('post:messages', 'Participate in subject-level chats', 'communication')
ON CONFLICT (name) DO NOTHING;

-- Map permissions to roles
DO $$
DECLARE
    admin_id UUID;
    lecturer_id UUID;
    student_id UUID;
BEGIN
    -- Admin Permissions
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT 'admin', id FROM public.permissions;

    -- Lecturer Permissions
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT 'lecturer', id FROM public.permissions 
    WHERE name IN ('view:analytics', 'manage:grading', 'manage:announcements', 'post:messages');

    -- Student Permissions
    INSERT INTO public.role_permissions (role, permission_id)
    SELECT 'student', id FROM public.permissions 
    WHERE name IN ('view:finance', 'post:messages');
END $$;

-- 5. RLS Policies
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins check permissions" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage permissions" ON public.permissions FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Users view relevant role permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage role_permissions" ON public.role_permissions FOR ALL TO authenticated USING (public.is_admin());


-- FILE: 20260225250000_auth_sync_integrity.sql
-- BIDIRECTIONAL AUTH SYNC & INTEGRITY SYSTEM

-- 1. DROP LEGACY TRIGGERS (Cleanup before strict implementation)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. ENHANCED SYNC FUNCTION (Handle Creation & Metadata Sync)
-- This function ensures auth.users metadata and public.profiles stay in perfect sync
CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Create Profile
        INSERT INTO public.profiles (
            user_id, 
            full_name, 
            email, 
            department_id, 
            batch, 
            status
        )
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            NEW.email,
            (NEW.raw_user_meta_data->>'department_id')::uuid,
            NEW.raw_user_meta_data->>'batch',
            COALESCE(NEW.raw_user_meta_data->>'status', 'active')
        );

        -- Create Role
        INSERT INTO public.user_roles (user_id, role)
        VALUES (
            NEW.id,
            COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student')
        );

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Sync Email and Meta updates from Auth to Profile
        -- We check if values changed to prevent unnecessary writes/loops
        UPDATE public.profiles
        SET 
            email = NEW.email,
            full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
            updated_at = now()
        WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- 3. REVERSE SYNC: PROFILE -> AUTH METADATA
-- Ensures that if an admin updates a profile's full_name, it reflects in Supabase Auth
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Avoid infinite loops by checking if the trigger is already running for this session
    -- Or simply ensuring we only trigger if specific fields changed
    IF (OLD.full_name IS DISTINCT FROM NEW.full_name OR OLD.email IS DISTINCT FROM NEW.email) THEN
        UPDATE auth.users
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object('full_name', NEW.full_name)
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

-- 4. CASCADE CLEANUP (Handle Deletion)
-- Handles cleaning up all associated enterprise data when a user is hard-deleted
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Force removal of related records if not already handled by foreign key cascades
    -- Audit logs are preserved (references are set to NULL by schema)
    DELETE FROM public.user_roles WHERE user_id = OLD.id;
    DELETE FROM public.profiles WHERE user_id = OLD.id;
    RETURN OLD;
END;
$$;

-- 5. APPLY TRIGGERS
-- Auth -> Profile (Insert/Update)
CREATE TRIGGER on_auth_user_sync
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();

-- Profile -> Auth (Metadata Sync)
DROP TRIGGER IF EXISTS tr_sync_profile_to_auth ON public.profiles;
CREATE TRIGGER tr_sync_profile_to_auth
  AFTER UPDATE OF full_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_auth();

-- Auth -> Cleanup (Delete)
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deletion();

-- 6. DATA VALIDATION CONSTRAINTS
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- 7. REPAIR ORPHANS (One-time fix for existing users)
INSERT INTO public.profiles (user_id, email, full_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', '')
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, COALESCE((raw_user_meta_data->>'role')::public.app_role, 'student')
FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;


-- FILE: 20260225260000_whatsapp_groups.sql
-- WHATSAPP-LIKE GROUP SYSTEM ENHANCEMENTS

-- 1. Enhance Groups Table
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT true;

-- 2. Enhance Direct Messages for Group Context
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- 3. Automatic Group Creator Membership
CREATE OR REPLACE FUNCTION public.handle_group_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_group_created
    AFTER INSERT ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.handle_group_creation();

-- 4. Triggers for updated_at
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;

-- 6. RLS POLICIES UPDATES

-- Drop old policies to replace them
DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Group admins can update" ON public.groups;

-- Group Table Policies
CREATE POLICY "Users can view groups they are members of"
ON public.groups FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Anyone authenticated can create groups"
ON public.groups FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins and system admins can update groups"
ON public.groups FOR UPDATE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid() AND role = 'admin') OR
    public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Group creators and system admins can delete groups"
ON public.groups FOR DELETE
TO authenticated
USING (
    created_by = auth.uid() OR
    public.has_role(auth.uid(), 'admin')
);

-- Group Members Policies
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can manage members" ON public.group_members;

CREATE POLICY "Members can see each other"
ON public.group_members FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Group admins manage membership"
ON public.group_members FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND role = 'admin') OR
    public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can join public groups"
ON public.group_members FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND is_private = false) OR
    auth.uid() = (SELECT created_by FROM public.groups WHERE id = group_id) -- Redundant because of trigger but for manual inserts
);

-- Messages RLS Update
DROP POLICY IF EXISTS "Users view own messages" ON public.direct_messages;

CREATE POLICY "Users view relevant messages"
ON public.direct_messages FOR SELECT
TO authenticated
USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR 
    (group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members WHERE group_members.group_id = direct_messages.group_id AND group_members.user_id = auth.uid()
    )) OR
    (subject_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.enrollments WHERE subject_id = direct_messages.subject_id AND student_id = auth.uid()
    ))
);


-- FILE: 20260225270000_fix_attendance_rls.sql
-- FIX ATTENDANCE RLS FOR ADMINS
DROP POLICY IF EXISTS "Admin view attendance" ON public.attendance;

CREATE POLICY "Admin manage attendance" ON public.attendance FOR ALL 
TO authenticated 
USING (public.is_admin());


-- FILE: 20260225280000_fix_group_recursion.sql
-- FIX INFINITE RECURSION IN GROUP POLICIES
-- The previous policies created a circular dependency between groups and group_members

-- 1. Create Security Definer functions to break the recursion
CREATE OR REPLACE FUNCTION public.check_group_membership(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.check_group_admin(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id AND role = 'admin');
$$;

-- 2. Drop problematic policies (including older versions)
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;
DROP POLICY IF EXISTS "Group admins and system admins can update groups" ON public.groups;
DROP POLICY IF EXISTS "User group access" ON public.groups;
DROP POLICY IF EXISTS "Group admin manage" ON public.groups;

DROP POLICY IF EXISTS "Members can see each other" ON public.group_members;
DROP POLICY IF EXISTS "Group admins manage membership" ON public.group_members;
DROP POLICY IF EXISTS "Member view group members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can manage members" ON public.group_members;

DROP POLICY IF EXISTS "Users view relevant messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users view own messages" ON public.direct_messages;

-- 3. Re-implement safely using functions
-- GROUPS
CREATE POLICY "Safe view groups" ON public.groups FOR SELECT 
TO authenticated 
USING (
    public.check_group_membership(id, auth.uid()) OR 
    public.is_admin()
);

CREATE POLICY "Safe update groups" ON public.groups FOR UPDATE 
TO authenticated 
USING (
    public.check_group_admin(id, auth.uid()) OR 
    public.is_admin()
);

-- GROUP MEMBERS
CREATE POLICY "Safe view members" ON public.group_members FOR SELECT 
TO authenticated 
USING (
    public.check_group_membership(group_id, auth.uid()) OR 
    public.is_admin()
);

CREATE POLICY "Safe manage members" ON public.group_members FOR ALL 
TO authenticated 
USING (
    public.check_group_admin(group_id, auth.uid()) OR 
    public.is_admin()
);

-- MESSAGES
CREATE POLICY "Safe view messages" ON public.direct_messages FOR SELECT 
TO authenticated 
USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR 
    (group_id IS NOT NULL AND public.check_group_membership(group_id, auth.uid())) OR
    (subject_id IS NOT NULL AND public.is_student_enrolled(subject_id))
);


-- FILE: 20260225290000_whatsapp_social.sql
-- WHATSAPP-LIKE 1-ON-1 AND BLOCKING SYSTEM
-- Reference profiles(user_id) for easier joining in Supabase client

-- 1. Fix direct_messages foreign keys for automatic joining
ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_sender_id_fkey;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_receiver_id_fkey;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- 2. Chat Contacts / Relationships (The Request/Accept/Block Logic)
CREATE TABLE IF NOT EXISTS public.chat_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
    contact_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, contact_id)
);

-- 3. RLS for Chat Contacts
ALTER TABLE public.chat_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
ON public.chat_contacts FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR contact_id = auth.uid());

CREATE POLICY "Users can manage their contacts"
ON public.chat_contacts FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- 4. Unified Messages View/Policy update
-- We need to ensure blockers can't send/receive messages
CREATE OR REPLACE FUNCTION public.is_blocked(_user_id UUID, _contact_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.chat_contacts 
        WHERE (user_id = _user_id AND contact_id = _contact_id AND status = 'blocked')
           OR (user_id = _contact_id AND contact_id = _user_id AND status = 'blocked')
    );
$$;

-- 5. Updated Message Policy (Strictly Enforcement)
DROP POLICY IF EXISTS "Safe view messages" ON public.direct_messages;

CREATE POLICY "whatsapp_message_access"
ON public.direct_messages FOR SELECT
TO authenticated
USING (
    (sender_id = auth.uid() OR receiver_id = auth.uid()) OR 
    (group_id IS NOT NULL AND public.check_group_membership(group_id, auth.uid())) OR
    (subject_id IS NOT NULL AND public.is_student_enrolled(subject_id))
);

CREATE POLICY "whatsapp_message_insert"
ON public.direct_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND (
        (receiver_id IS NOT NULL AND NOT public.is_blocked(auth.uid(), receiver_id)) OR
        (group_id IS NOT NULL AND public.check_group_membership(group_id, auth.uid())) OR
        (subject_id IS NOT NULL AND public.is_lecturer_of_subject(subject_id)) -- Lecturer to subject
    )
);

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_contacts;


-- FILE: 20260225300000_events_system.sql
-- EVENTS SYSTEM
-- 1. Ensure Events Table and Columns exist
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    location TEXT,
    image_url TEXT,
    category TEXT DEFAULT 'General',
    is_published BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add/Modify columns to match the required schema
DO $$ 
BEGIN 
    -- Drop NOT NULL from created_by if it exists
    ALTER TABLE public.events ALTER COLUMN created_by DROP NOT NULL;

    -- Add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='image_url') THEN
        ALTER TABLE public.events ADD COLUMN image_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='category') THEN
        ALTER TABLE public.events ADD COLUMN category TEXT DEFAULT 'General';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='is_published') THEN
        ALTER TABLE public.events ADD COLUMN is_published BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 2. Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Anyone can view published events" ON public.events;
CREATE POLICY "Anyone can view published events" 
ON public.events 
FOR SELECT 
TO authenticated 
USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
CREATE POLICY "Admins can manage events" 
ON public.events 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Sample Data
INSERT INTO public.events (title, description, event_date, location, category)
VALUES 
('Annual Tech Symposium 2024', 'A gathering of innovators and tech enthusiasts to showcase projects and attend workshops.', '2024-10-15 09:00:00+00', 'Main Auditorium', 'Academic'),
('Inter-Batch Cricket Tournament', 'The much-awaited annual sports event where batches compete for the trophy.', '2024-11-05 08:30:00+00', 'Campus Grounds', 'Sports'),
('Freshers Welcome 2024', 'A night of music, dance, and networking to welcome the new cohort.', '2024-09-20 18:00:00+00', 'Grand Hall', 'Cultural')
ON CONFLICT DO NOTHING;


-- FILE: 20260225310000_fix_empty_pages_rls.sql
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


-- FILE: 20260225320000_fix_policy_recursion.sql
-- FINAL RECURSION FIX & SECURITY OPTIMIZATION
-- This migration fixes the "infinite recursion" by ensuring all security functions
-- are SECURITY DEFINER with a fixed search_path, allowing them to bypass RLS safely.

-- 1. FIX CORE SECURITY FUNCTIONS (Ensure no recursion)
-- Drop old versions first
DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_department() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_batch() CASCADE;

-- Recreate with SECURITY DEFINER and SET search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.get_my_department()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_batch()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT batch FROM public.profiles WHERE user_id = auth.uid();
$$;

-- 2. RE-IMPLEMENT POLICIES WITHOUT DIRECT TABLE RECURSION
-- Use the SECURITY DEFINER functions instead of subqueries in USING clauses

-- PROFILES
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles_Self_Visibility" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Admin_Visibility" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Department_Visibility" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Lecturer view department profiles" ON public.profiles;
DROP POLICY IF EXISTS "Student view same batch/dept" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles_Base_Policy" ON public.profiles FOR SELECT 
  USING (
    user_id = auth.uid() OR 
    public.is_admin() OR
    (department_id IS NOT NULL AND department_id = public.get_my_department())
  );

CREATE POLICY "Profiles_Self_Update" ON public.profiles FOR UPDATE USING (user_id = auth.uid());

-- USER ROLES
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admin manage all roles" ON public.user_roles;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles_Base_Policy" ON public.user_roles FOR SELECT 
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Roles_Admin_Management" ON public.user_roles FOR ALL 
  USING (public.is_admin());

-- SUBJECTS (Ensuring visibility for everyone as a fallback for enrollment)
ALTER TABLE public.subjects DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Subjects_Admin_Access" ON public.subjects;
DROP POLICY IF EXISTS "Subjects_Lecturer_Access" ON public.subjects;
DROP POLICY IF EXISTS "Subjects_Lecturer_Update" ON public.subjects;
DROP POLICY IF EXISTS "Subjects_General_Visibility" ON public.subjects;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subjects_Visibility" ON public.subjects FOR SELECT 
  USING (
    public.is_admin() OR
    lecturer_id = auth.uid() OR
    department_id IS NULL OR 
    department_id = public.get_my_department() OR
    EXISTS (SELECT 1 FROM public.enrollments WHERE subject_id = id AND student_id = auth.uid())
  );

CREATE POLICY "Subjects_Admin_Manage" ON public.subjects FOR ALL USING (public.is_admin());

-- 3. FIX STORAGE BUCKET POLICIES (Bypass recursive profile checks)
-- Ensure 'assignments' bucket is fully public for reading to avoid RLS overhead
UPDATE storage.buckets SET public = true WHERE id = 'assignments';

-- 4. FINAL CLEANUP OF ANY RECURSIVE ENROLLMENT POLICIES
ALTER TABLE public.enrollments DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enrollments_Admin_Access" ON public.enrollments;
DROP POLICY IF EXISTS "Enrollments_Lecturer_Visibility" ON public.enrollments;
DROP POLICY IF EXISTS "Enrollments_Student_Visibility" ON public.enrollments;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enrollments_Access" ON public.enrollments FOR SELECT 
  USING (
    student_id = auth.uid() OR 
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.subjects WHERE id = subject_id AND lecturer_id = auth.uid())
  );

CREATE POLICY "Enrollments_Admin_Manage" ON public.enrollments FOR ALL USING (public.is_admin());


-- FILE: 20260225330000_strict_chat_flow.sql
-- CHAT SYSTEM REFINEMENT
-- 1. Update Profiles Policy to allow searching for all users
-- This allows the "Find a Peer" feature to work across the whole campus
DROP POLICY IF EXISTS "Profiles_Base_Policy" ON public.profiles;
CREATE POLICY "Profiles_Base_Policy" ON public.profiles FOR SELECT 
  USING (
    user_id = auth.uid() OR 
    public.is_admin() OR
    department_id = public.get_my_department() OR
    auth.uid() IS NOT NULL -- Allow all authenticated users to see basic profile info
  );

-- 2. Update Direct Messages Policy to require 'accepted' status for 1-on-1s
-- This enforces the "Request/Accept" flow at the database level
DROP POLICY IF EXISTS "whatsapp_message_insert" ON public.direct_messages;

CREATE POLICY "strict_chat_insert_policy"
ON public.direct_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND (
        -- Group messages: Check membership
        (group_id IS NOT NULL AND public.check_group_membership(group_id, auth.uid())) OR
        -- Subject messages: Lecturer to subject
        (subject_id IS NOT NULL AND public.is_lecturer_of_subject(subject_id)) OR
        -- 1-on-1 messages: Must be 'accepted' in chat_contacts
        (receiver_id IS NOT NULL AND (
            public.is_admin() OR -- Admins can bypass for support/moderation
            EXISTS (
                SELECT 1 FROM public.chat_contacts
                WHERE (
                    (user_id = auth.uid() AND contact_id = receiver_id AND status = 'accepted') OR
                    (user_id = receiver_id AND contact_id = auth.uid() AND status = 'accepted')
                )
            )
        ))
    )
);

-- 3. Add column to profiles for bio/phone if they don't exist (Enterprise extension)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;


-- FILE: 20260225340000_notification_system.sql
-- NOTIFICATION SYSTEM
-- This system handles alerts for chat requests, grades, and system updates.

-- 1. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE, -- Who triggered the notification?
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('chat_request', 'grade_posted', 'announcement', 'system')),
    link TEXT, -- Optional URL or path to redirect
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 3. RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notifications"
ON public.notifications FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. Automation: Chat Request Notification
CREATE OR REPLACE FUNCTION public.notify_chat_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_name TEXT;
BEGIN
    -- Get Actor Name safely
    SELECT COALESCE(full_name, 'A peer') INTO actor_name FROM public.profiles WHERE user_id = NEW.user_id;

    IF (NEW.status = 'pending') THEN
        INSERT INTO public.notifications (user_id, actor_id, title, content, type, link)
        VALUES (
            NEW.contact_id, 
            NEW.user_id, 
            'New Chat Request', 
            actor_name || ' wants to connect with you.',
            'chat_request',
            '/groups'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_chat_request ON public.chat_contacts;
CREATE TRIGGER tr_notify_chat_request
  AFTER INSERT ON public.chat_contacts
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.notify_chat_request();

-- 5. Automation: Acceptance Notification
CREATE OR REPLACE FUNCTION public.notify_chat_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_id UUID := auth.uid();
    target_id UUID;
    actor_name TEXT;
BEGIN
    -- Only proceed if status flipped from pending to accepted
    IF (NEW.status = 'accepted' AND OLD.status = 'pending') THEN
        -- Safely get actor's name
        SELECT COALESCE(full_name, 'A peer') INTO actor_name FROM public.profiles WHERE user_id = actor_id;

        -- Identify who we are notifying (the person who DID NOT accept)
        IF (NEW.user_id = actor_id) THEN
            target_id := NEW.contact_id;
        ELSE
            target_id := NEW.user_id;
        END IF;

        INSERT INTO public.notifications (user_id, actor_id, title, content, type, link)
        VALUES (
            target_id,
            actor_id,
            'Request Accepted', 
            actor_name || ' accepted your chat request!',
            'chat_request',
            '/groups'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_chat_acceptance ON public.chat_contacts;
CREATE TRIGGER tr_notify_chat_acceptance
  AFTER UPDATE OF status ON public.chat_contacts
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status = 'pending')
  EXECUTE FUNCTION public.notify_chat_acceptance();


-- FILE: 20260225350000_break_subject_recursion.sql
-- BREAK INFINITE RECURSION IN SUBJECTS/ENROLLMENTS
-- This migration replaces recursive subqueries in RLS policies with SECURITY DEFINER functions.

-- 1. Ensure helper functions are robust (SECURITY DEFINER + search_path)
CREATE OR REPLACE FUNCTION public.is_lecturer_of_subject(_subject_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.subjects WHERE id = _subject_id AND lecturer_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_student_enrolled(_subject_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.enrollments WHERE student_id = auth.uid() AND subject_id = _subject_id);
$$;

-- 2. RE-IMPLEMENT SUBJECTS POLICY
DROP POLICY IF EXISTS "Subjects_Visibility" ON public.subjects;
CREATE POLICY "Subjects_Visibility" ON public.subjects FOR SELECT 
  USING (
    public.is_admin() OR
    lecturer_id = auth.uid() OR
    department_id IS NULL OR 
    department_id = public.get_my_department() OR
    public.is_student_enrolled(id) -- Uses SECURITY DEFINER function to break recursion
  );

-- 3. RE-IMPLEMENT ENROLLMENTS POLICY
DROP POLICY IF EXISTS "Enrollments_Access" ON public.enrollments;
CREATE POLICY "Enrollments_Access" ON public.enrollments FOR SELECT 
  USING (
    student_id = auth.uid() OR 
    public.is_admin() OR
    public.is_lecturer_of_subject(subject_id) -- Uses SECURITY DEFINER function to break recursion
  );


-- FILE: 20260226100000_restore_timetable_rls.sql
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


-- FILE: 20260226110000_fix_exams_rls.sql
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


-- FILE: 20260226120000_fix_all_recursion.sql
-- FIX INFINITE RECURSION IN GROUP & ROLE POLICIES
-- This migration converts key security functions to PLPGSQL to prevent inlining
-- and ensure SECURITY DEFINER bypasses RLS correctly, ending recursion loops.

-- 1. RECREATE CORE SECURITY FUNCTIONS WITH PLPGSQL (NO INLINING)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.has_role(auth.uid(), 'admin');
END;
$$;

-- 2. RECREATE GROUP MEMBERSHIP FUNCTIONS WITH PLPGSQL
CREATE OR REPLACE FUNCTION public.check_group_membership(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = _group_id AND user_id = _user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_group_admin(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = _group_id AND user_id = _user_id AND role = 'admin'
  );
END;
$$;

-- 3. FIX GROUP MEMBERS POLICIES
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Safe view members" ON public.group_members;
DROP POLICY IF EXISTS "Safe manage members" ON public.group_members;
DROP POLICY IF EXISTS "Members can see each other" ON public.group_members;
DROP POLICY IF EXISTS "Group admins manage membership" ON public.group_members;
DROP POLICY IF EXISTS "Users can join public groups" ON public.group_members;

-- Implement robust policies for group_members
CREATE POLICY "Group_Members_Select" ON public.group_members FOR SELECT 
TO authenticated 
USING (
    public.check_group_membership(group_id, auth.uid()) OR 
    public.is_admin()
);

-- For INSERT/UPDATE/DELETE, we use the specific admin/self checks
CREATE POLICY "Group_Members_Manage" ON public.group_members FOR ALL 
TO authenticated 
USING (
    public.check_group_admin(group_id, auth.uid()) OR 
    public.is_admin()
);

-- Explicit INSERT policy to allow joining or initial creator entry
-- Note: Trigger handle_group_creation is already SECURITY DEFINER and bypasses RLS
CREATE POLICY "Group_Members_Insert" ON public.group_members FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() = user_id OR -- Users can add themselves (if groups allows it)
    public.check_group_admin(group_id, auth.uid()) OR 
    public.is_admin()
);

-- 4. FIX GROUP POLICIES
DROP POLICY IF EXISTS "Safe view groups" ON public.groups;
DROP POLICY IF EXISTS "Safe update groups" ON public.groups;
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;

CREATE POLICY "Groups_Select" ON public.groups FOR SELECT 
TO authenticated 
USING (
    public.check_group_membership(id, auth.uid()) OR 
    public.is_admin()
);

CREATE POLICY "Groups_Manage" ON public.groups FOR UPDATE 
TO authenticated 
USING (
    public.check_group_admin(id, auth.uid()) OR 
    public.is_admin()
);


-- FILE: 20260226130000_fix_social_notifications.sql
-- ENHANCED NOTIFICATION TRIGGERS
-- Fixes issues where notifications wouldn't "pop" or send on status updates.

-- 1. Improved Chat Request Notification (Handles Insert & Update)
CREATE OR REPLACE FUNCTION public.notify_chat_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_name TEXT;
BEGIN
    -- Only fire if status is pending (New request or re-request)
    IF (NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending')) THEN
        
        -- The actor is the person who initiated/updated the record (NEW.user_id)
        SELECT COALESCE(full_name, 'A peer') INTO actor_name FROM public.profiles WHERE user_id = NEW.user_id;

        INSERT INTO public.notifications (user_id, actor_id, title, content, type, link)
        VALUES (
            NEW.contact_id, -- Notify the receiver
            NEW.user_id,    -- The sender is the actor
            'New Chat Request', 
            actor_name || ' wants to connect with you.',
            'chat_request',
            '/groups'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_chat_request ON public.chat_contacts;
CREATE TRIGGER tr_notify_chat_request
  AFTER INSERT OR UPDATE OF status ON public.chat_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_request();

-- 2. Improved Acceptance Notification
CREATE OR REPLACE FUNCTION public.notify_chat_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_id UUID;
    target_id UUID;
    actor_name TEXT;
BEGIN
    -- Only proceed if status flipped from pending to accepted
    IF (NEW.status = 'accepted' AND OLD.status = 'pending') THEN
        
        -- The person who accepted is the 'contact_id' in a standard flow
        -- But to be safe, we assume the CURRENT USER is the actor
        actor_id := auth.uid();
        
        -- Fallback: if auth.uid() is null (e.g. system action), we assume contact_id accepted
        IF actor_id IS NULL THEN
            actor_id := NEW.contact_id;
        END IF;

        -- Identify who we are notifying (the person who DID NOT perform the action)
        IF (NEW.user_id = actor_id) THEN
            target_id := NEW.contact_id;
        ELSE
            target_id := NEW.user_id;
        END IF;

        -- Get actor's name
        SELECT COALESCE(full_name, 'A peer') INTO actor_name FROM public.profiles WHERE user_id = actor_id;

        INSERT INTO public.notifications (user_id, actor_id, title, content, type, link)
        VALUES (
            target_id,
            actor_id,
            'Request Accepted', 
            actor_name || ' accepted your chat request!',
            'chat_request',
            '/groups'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_chat_acceptance ON public.chat_contacts;
CREATE TRIGGER tr_notify_chat_acceptance
  AFTER UPDATE OF status ON public.chat_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_acceptance();


-- FILE: 20260226150000_fix_notification_query_ambiguity.sql
-- FIX NOTIFICATION FK AMBIGUITY
-- Explicitly naming foreign keys so the frontend select query works perfectly.

ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS notifications_actor_id_fkey;
ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS notifications_actor_id_profiles_fkey;

ALTER TABLE public.notifications 
    ADD CONSTRAINT notifications_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.notifications 
    ADD CONSTRAINT notifications_actor_id_fkey 
    FOREIGN KEY (actor_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Ensure RLS is sane and non-recursive
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users_Manage_Own_Notifications"
ON public.notifications FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- FILE: 20260226160000_final_recursion_and_schema_fix.sql
-- FINAL RECURSION KILLER & SCHEMA FIX
-- This script fixes the 400 error on submissions and the 500 error on groups.

-- 1. FIX SUBMISSIONS TABLE (Add status column for easier filtering)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='submissions' AND column_name='status') THEN
        ALTER TABLE public.submissions ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'graded', 'resubmitted'));
    END IF;
END $$;

-- 2. BREAK RECURSION IN USER_ROLES (The Root Cause)
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_read_fixed" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Create a recursion-free admin check for RLS
CREATE OR REPLACE FUNCTION public.is_admin_check()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- We look directly at the table; SECURITY DEFINER bypasses RLS
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
END; $$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SIMPLE POLICY: No complex joins or function calls that loop back
CREATE POLICY "role_access_v3" ON public.user_roles FOR SELECT TO authenticated 
USING (user_id = auth.uid() OR public.is_admin_check());


-- 3. BREAK RECURSION IN GROUPS & MEMBERS
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_visibility" ON public.groups;
DROP POLICY IF EXISTS "member_visibility" ON public.group_members;

-- Safe membership check (SECURITY DEFINER + PLPGSQL prevents inlining)
CREATE OR REPLACE FUNCTION public.check_membership(_group_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = auth.uid()) 
         OR public.is_admin_check();
END; $$;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_active_policy" ON public.groups FOR SELECT 
TO authenticated USING (public.check_membership(id));

CREATE POLICY "members_active_policy" ON public.group_members FOR SELECT 
TO authenticated USING (user_id = auth.uid() OR public.check_membership(group_id));

-- 4. FIX CHAT CONTACTS (Accepting requests)
ALTER TABLE public.chat_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts_access_final" ON public.chat_contacts;
CREATE POLICY "contacts_final_v3" ON public.chat_contacts FOR ALL 
TO authenticated USING (user_id = auth.uid() OR contact_id = auth.uid());


-- FILE: 20260226170000_kill_all_recursion_final.sql
-- FINAL GROUP RECURSION FIX (STRICT BYPASS)
-- This script stops the 500 error by removing all subqueries from RLS policies.
-- It uses PL/pgSQL Security Definer functions which are guaranteed to break the loop.

-- 1. FORCE SHUTDOWN RLS
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;

-- 2. WIPE ALL HISTORIC POLICIES
DROP POLICY IF EXISTS "role_access_final" ON public.user_roles;
DROP POLICY IF EXISTS "role_visibility" ON public.user_roles;
DROP POLICY IF EXISTS "groups_access_final" ON public.groups;
DROP POLICY IF EXISTS "group_visibility" ON public.groups;
DROP POLICY IF EXISTS "members_access_final" ON public.group_members;
DROP POLICY IF EXISTS "member_visibility" ON public.group_members;

-- 3. RECREATE BYPASS FUNCTIONS (PL/pgSQL + SECURITY DEFINER)
-- These functions operate as 'system' and do not trigger RLS.

CREATE OR REPLACE FUNCTION public.is_admin_bypass()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
END; $$;

CREATE OR REPLACE FUNCTION public.is_group_member_bypass(_group_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = auth.uid())
           OR public.is_admin_bypass();
END; $$;

-- 4. APPLY CLEAN POLICIES (No subqueries in USING clauses)

-- USER ROLES
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_v4" ON public.user_roles FOR SELECT TO authenticated 
USING (user_id = auth.uid() OR public.is_admin_bypass());

-- GROUPS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups_select_v4" ON public.groups FOR SELECT TO authenticated 
USING (public.is_group_member_bypass(id));

-- GROUP MEMBERS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_members_select_v4" ON public.group_members FOR SELECT TO authenticated 
USING (public.is_group_member_bypass(group_id));

-- Ensure INSERT/UPDATE/DELETE also use the bypass
CREATE POLICY "group_members_manage_v4" ON public.group_members FOR ALL TO authenticated 
USING (public.is_admin_bypass());


-- FILE: 20260226180000_social_hub_ultimate_fix.sql
-- SOCIAL HUB ULTIMATE FIX (Schema + RLS + Realtime)
-- This migration fixes the 500 error, 400 error, and message sync issues.

-- 1. CLEANUP OLD POLICIES (FORCE RESET)
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_final" ON public.groups;
DROP POLICY IF EXISTS "members_final" ON public.group_members;
DROP POLICY IF EXISTS "contacts_final" ON public.chat_contacts;
DROP POLICY IF EXISTS "whatsapp_message_access" ON public.direct_messages;
DROP POLICY IF EXISTS "whatsapp_message_insert" ON public.direct_messages;

-- 2. RECURSION KILLER FUNCTIONS (PL/pgSQL + SECURITY DEFINER)
-- These functions break the loop by accessing tables directly as postgres user.

CREATE OR REPLACE FUNCTION public.su_is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
END; $$;

CREATE OR REPLACE FUNCTION public.su_check_group_member(_group_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.su_check_group_admin(_group_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = auth.uid() AND role = 'admin');
END; $$;

-- 3. SCHEMA UPDATES (Ensure columns match frontend code)
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Fix Foreign Keys for Profile joins in Social Hub
ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_sender_id_fkey;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.chat_contacts DROP CONSTRAINT IF EXISTS chat_contacts_user_id_fkey;
ALTER TABLE public.chat_contacts ADD CONSTRAINT chat_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.chat_contacts DROP CONSTRAINT IF EXISTS chat_contacts_contact_id_fkey;
ALTER TABLE public.chat_contacts ADD CONSTRAINT chat_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- 4. APPLY CLEAN, NON-RECURSIVE POLICIES

-- USER ROLES
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ur_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.su_is_admin());

-- GROUPS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups_select" ON public.groups FOR SELECT TO authenticated USING (public.su_check_group_member(id) OR public.su_is_admin());
CREATE POLICY "groups_insert" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "groups_update" ON public.groups FOR UPDATE TO authenticated USING (public.su_check_group_admin(id) OR public.su_is_admin());
CREATE POLICY "groups_delete" ON public.groups FOR DELETE TO authenticated USING (public.su_check_group_admin(id) OR public.su_is_admin());

-- GROUP MEMBERS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gm_select" ON public.group_members FOR SELECT TO authenticated USING (public.su_check_group_member(group_id) OR public.su_is_admin());
CREATE POLICY "gm_insert" ON public.group_members FOR INSERT TO authenticated WITH CHECK (true); -- Trigger handles safety
CREATE POLICY "gm_delete" ON public.group_members FOR DELETE TO authenticated USING (public.su_check_group_admin(group_id) OR user_id = auth.uid() OR public.su_is_admin());

-- CHAT CONTACTS
ALTER TABLE public.chat_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_select" ON public.chat_contacts FOR SELECT TO authenticated USING (user_id = auth.uid() OR contact_id = auth.uid() OR public.su_is_admin());
CREATE POLICY "cc_insert" ON public.chat_contacts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "cc_manage" ON public.chat_contacts FOR ALL TO authenticated USING (user_id = auth.uid() OR contact_id = auth.uid());

-- DIRECT MESSAGES (Crucial for sync)
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_select" ON public.direct_messages FOR SELECT TO authenticated 
USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR 
    (group_id IS NOT NULL AND public.su_check_group_member(group_id))
);

CREATE POLICY "dm_insert" ON public.direct_messages FOR INSERT TO authenticated 
WITH CHECK (
    sender_id = auth.uid() AND (
        (receiver_id IS NOT NULL) OR 
        (group_id IS NOT NULL AND public.su_check_group_member(group_id))
    )
);

-- 5. ENABLE REALTIME FOR EVERYTHING
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'direct_messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_contacts') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_contacts;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'groups') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'group_members') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
    END IF;
END $$;


-- FILE: 20260226190000_social_hub_resurrection.sql
-- SOCIAL HUB REPAIR: RECURSION KILLER & SCHEMA FIX
-- This script fixes the 500 and 400 errors once and for all.

-- 1. CLEAN SLATE: Disable RLS and clear ALL policies (aggressive)
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages DISABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. RECURSION-PROOF CORE FUNCTIONS (PL/pgSQL ONLY)
-- We use PL/pgSQL to prevent Postgres from 'inlining' the logic and causing recursive loops.

CREATE OR REPLACE FUNCTION public.su_is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
END; $$;

CREATE OR REPLACE FUNCTION public.su_get_my_groups()
RETURNS UUID[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN ARRAY(SELECT group_id FROM public.group_members WHERE user_id = auth.uid());
END; $$;

-- This checks if there is a 'blocked' status between two users
CREATE OR REPLACE FUNCTION public.su_is_blocked(_u1 UUID, _u2 UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.chat_contacts 
        WHERE ((user_id = _u1 AND contact_id = _u2) OR (user_id = _u2 AND contact_id = _u1))
        AND status = 'blocked'
    );
END; $$;

-- 3. ENSURE TABLE STRUCTURE (The 400 Error fix)
-- PostgREST needs explicit foreign keys to resolve joins correctly.

ALTER TABLE public.chat_contacts DROP CONSTRAINT IF EXISTS chat_contacts_user_id_fkey;
ALTER TABLE public.chat_contacts ADD CONSTRAINT chat_contacts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.chat_contacts DROP CONSTRAINT IF EXISTS chat_contacts_contact_id_fkey;
ALTER TABLE public.chat_contacts ADD CONSTRAINT chat_contacts_contact_id_fkey 
    FOREIGN KEY (contact_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- 4. APPLY CLEAN, FLAT POLICIES (No nested queries)

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ur_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.su_is_admin());

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "g_read" ON public.groups FOR SELECT TO authenticated USING (id = ANY(public.su_get_my_groups()) OR public.su_is_admin());
CREATE POLICY "g_all" ON public.groups FOR ALL TO authenticated USING (public.su_is_admin()) WITH CHECK (public.su_is_admin());

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gm_read" ON public.group_members FOR SELECT TO authenticated USING (group_id = ANY(public.su_get_my_groups()) OR public.su_is_admin());
CREATE POLICY "gm_all" ON public.group_members FOR ALL TO authenticated USING (public.su_is_admin());

ALTER TABLE public.chat_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_access" ON public.chat_contacts FOR ALL TO authenticated 
USING (user_id = auth.uid() OR contact_id = auth.uid())
WITH CHECK (user_id = auth.uid() OR contact_id = auth.uid());

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_read" ON public.direct_messages FOR SELECT TO authenticated 
USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR 
    group_id = ANY(public.su_get_my_groups())
);

CREATE POLICY "dm_send" ON public.direct_messages FOR INSERT TO authenticated 
WITH CHECK (
    sender_id = auth.uid() AND 
    (
        (receiver_id IS NOT NULL AND NOT public.su_is_blocked(auth.uid(), receiver_id)) OR 
        (group_id IS NOT NULL AND group_id = ANY(public.su_get_my_groups()))
    )
);

-- 5. RE-SYNC REALTIME
DO $$ 
BEGIN 
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages, public.chat_contacts, public.groups, public.group_members; EXCEPTION WHEN OTHERS THEN END;
END $$;


-- FILE: 20260226200000_atomic_social_fix.sql
-- Social / messaging repair 2026-02-26: final atomic fix
-- This script fixes the 400 (POST error), 500 (Recursion), and Notifications.

-- 1. FIX NOTIFICATIONS SCHEMA FIRST (Triggers depend on this)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- 2. RESET SECURITY & BREAK RECURSION LOOPS
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages DISABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('user_roles', 'groups', 'group_members', 'notifications', 'chat_contacts', 'direct_messages')) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3. BYPASS FUNCTIONS (Guaranteed Non-Recursive)
CREATE OR REPLACE FUNCTION public.su_is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'); END; $$;

CREATE OR REPLACE FUNCTION public.su_my_groups()
RETURNS UUID[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN ARRAY(SELECT group_id FROM public.group_members WHERE user_id = auth.uid()); END; $$;

-- 4. CLEAN POLICIES
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ur_final" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.su_is_admin());

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "g_final" ON public.groups FOR SELECT TO authenticated USING (id = ANY(public.su_my_groups()) OR public.su_is_admin());

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gm_final" ON public.group_members FOR SELECT TO authenticated USING (group_id = ANY(public.su_my_groups()) OR public.su_is_admin());

ALTER TABLE public.chat_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_final" ON public.chat_contacts FOR ALL TO authenticated USING (user_id = auth.uid() OR contact_id = auth.uid()) WITH CHECK (user_id = auth.uid() OR contact_id = auth.uid());

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "n_final" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_final" ON public.direct_messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR group_id = ANY(public.su_my_groups()));
CREATE POLICY "dm_send" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- 5. FIX NOTIFICATION TRIGGERS (Use correct column 'message')
CREATE OR REPLACE FUNCTION public.notify_chat_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_name TEXT;
BEGIN
    IF (NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending')) THEN
        SELECT COALESCE(full_name, 'A peer') INTO actor_name FROM public.profiles WHERE user_id = NEW.user_id;
        INSERT INTO public.notifications (user_id, actor_id, title, message, type, link)
        VALUES (NEW.contact_id, NEW.user_id, 'New Chat Request', actor_name || ' wants to connect.', 'chat_request', '/groups');
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER tr_notify_chat_request AFTER INSERT OR UPDATE OF status ON public.chat_contacts FOR EACH ROW EXECUTE FUNCTION public.notify_chat_request();

CREATE OR REPLACE FUNCTION public.notify_chat_acceptance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_id UUID; target_id UUID; actor_name TEXT;
BEGIN
    IF (NEW.status = 'accepted' AND OLD.status = 'pending') THEN
        actor_id := auth.uid();
        IF actor_id IS NULL THEN actor_id := NEW.contact_id; END IF;
        IF (NEW.user_id = actor_id) THEN target_id := NEW.contact_id; ELSE target_id := NEW.user_id; END IF;
        SELECT COALESCE(full_name, 'A peer') INTO actor_name FROM public.profiles WHERE user_id = actor_id;
        INSERT INTO public.notifications (user_id, actor_id, title, message, type, link)
        VALUES (target_id, actor_id, 'Request Accepted', actor_name || ' accepted your request!', 'chat_request', '/groups');
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER tr_notify_chat_acceptance AFTER UPDATE OF status ON public.chat_contacts FOR EACH ROW EXECUTE FUNCTION public.notify_chat_acceptance();

-- 6. FIX AMBIGUITY (The 400/500 query Fix)
ALTER TABLE public.chat_contacts DROP CONSTRAINT IF EXISTS chat_contacts_user_id_fkey;
ALTER TABLE public.chat_contacts ADD CONSTRAINT chat_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.chat_contacts DROP CONSTRAINT IF EXISTS chat_contacts_contact_id_fkey;
ALTER TABLE public.chat_contacts ADD CONSTRAINT chat_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_actor_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;


-- FILE: 20260226210000_social_hub_ux_boost.sql
-- SOCIAL HUB PERFORMANCE & UX ENHANCEMENT
-- This script adds a 'last_message_at' field for instant sorting and unread indicators.

-- 1. Update Tables
ALTER TABLE public.chat_contacts ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now();

-- 2. Create Trigger Function to update these timestamps
CREATE OR REPLACE FUNCTION public.sync_last_message_time()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- For Direct Chats
    IF NEW.receiver_id IS NOT NULL THEN
        UPDATE public.chat_contacts 
        SET last_message_at = NEW.created_at
        WHERE (user_id = NEW.sender_id AND contact_id = NEW.receiver_id)
           OR (user_id = NEW.receiver_id AND contact_id = NEW.sender_id);
    END IF;

    -- For Group Chats
    IF NEW.group_id IS NOT NULL THEN
        UPDATE public.groups 
        SET last_message_at = NEW.created_at
        WHERE id = NEW.group_id;
    END IF;

    RETURN NEW;
END; $$;

-- 3. Attach Trigger
DROP TRIGGER IF EXISTS tr_sync_last_message_time ON public.direct_messages;
CREATE TRIGGER tr_sync_last_message_time
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.sync_last_message_time();

-- 4. Re-sync existing data (Best effort)
UPDATE public.chat_contacts c
SET last_message_at = (
    SELECT MAX(created_at) 
    FROM public.direct_messages 
    WHERE (sender_id = c.user_id AND receiver_id = c.contact_id)
       OR (sender_id = c.contact_id AND receiver_id = c.user_id)
)
WHERE EXISTS (
    SELECT 1 FROM public.direct_messages 
    WHERE (sender_id = c.user_id AND receiver_id = c.contact_id)
       OR (sender_id = c.contact_id AND receiver_id = c.user_id)
);

UPDATE public.groups g
SET last_message_at = (
    SELECT MAX(created_at) 
    FROM public.direct_messages 
    WHERE group_id = g.id
)
WHERE EXISTS (
    SELECT 1 FROM public.direct_messages 
    WHERE group_id = g.id
);


-- FILE: 20260226220000_social_hub_previews.sql
-- SOCIAL HUB UI BOOST: MESSAGE PREVIEWS & UNREAD INDICATORS
-- This script adds last_message_content and last_read_at for a premium WhatsApp-like experience.

-- 1. Add Columns for Previews and Sync
ALTER TABLE public.chat_contacts ADD COLUMN IF NOT EXISTS last_message_content TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS last_message_content TEXT;

-- 2. Update the Sync Trigger to include the content
CREATE OR REPLACE FUNCTION public.sync_last_message_time()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Update Direct Chat contact timestamp and preview
    IF NEW.receiver_id IS NOT NULL THEN
        UPDATE public.chat_contacts 
        SET 
            last_message_at = NEW.created_at,
            last_message_content = CASE 
                WHEN length(NEW.content) > 30 THEN left(NEW.content, 27) || '...'
                ELSE NEW.content 
            END
        WHERE (user_id = NEW.sender_id AND contact_id = NEW.receiver_id) 
           OR (user_id = NEW.receiver_id AND contact_id = NEW.sender_id);
    END IF;
    
    -- Update Group Chat timestamp and preview
    IF NEW.group_id IS NOT NULL THEN
        UPDATE public.groups 
        SET 
            last_message_at = NEW.created_at,
            last_message_content = CASE 
                WHEN length(NEW.content) > 30 THEN left(NEW.content, 27) || '...'
                ELSE NEW.content 
            END
        WHERE id = NEW.group_id;
    END IF;
    
    RETURN NEW;
END; $$;

-- 3. Initial Sync for existing messages
UPDATE public.chat_contacts c
SET 
  last_message_at = m.created_at,
  last_message_content = left(m.content, 30)
FROM (
  SELECT DISTINCT ON (thread_id) 
    created_at, content, 
    COALESCE(group_id, (CASE WHEN sender_id < receiver_id THEN sender_id || receiver_id ELSE receiver_id || sender_id END)::uuid) as thread_id
  FROM public.direct_messages
  ORDER BY thread_id, created_at DESC
) m
WHERE last_message_at IS NULL;


-- FILE: 20260226230000_message_notifications.sql
-- SOCIAL HUB REAL-TIME ALERTS: NEW MESSAGE NOTIFICATIONS
-- This script ensures that when you get a message, a notification is created so you get the "Pop" alert.

-- 1. Create the Message Notification function
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    sender_name TEXT;
BEGIN
    -- Only notify for direct messages (not group for now to avoid spam, or add group logic)
    IF NEW.receiver_id IS NOT NULL THEN
        -- Get the sender's name
        SELECT COALESCE(full_name, 'A peer') INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;

        -- Insert a notification for the receiver
        INSERT INTO public.notifications (user_id, actor_id, title, message, type, link)
        VALUES (
            NEW.receiver_id, 
            NEW.sender_id,
            'New Message', 
            sender_name || ': ' || (CASE WHEN length(NEW.content) > 30 THEN left(NEW.content, 27) || '...' ELSE NEW.content END),
            'message',
            '/groups'
        );
    END IF;

    -- For Groups (Notify all members except the sender)
    IF NEW.group_id IS NOT NULL THEN
        SELECT COALESCE(full_name, 'A peer') INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;

        INSERT INTO public.notifications (user_id, actor_id, title, message, type, link)
        SELECT 
            user_id, 
            NEW.sender_id, 
            'New Group Message', 
            sender_name || ' in Group: ' || (CASE WHEN length(NEW.content) > 30 THEN left(NEW.content, 27) || '...' ELSE NEW.content END),
            'message',
            '/groups'
        FROM public.group_members 
        WHERE group_id = NEW.group_id AND user_id != NEW.sender_id;
    END IF;

    RETURN NEW;
END; $$;

-- 2. Attach the trigger
DROP TRIGGER IF EXISTS tr_notify_new_message ON public.direct_messages;
CREATE TRIGGER tr_notify_new_message
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();


-- FILE: 20260226250000_user_roles_policies.sql
-- Add INSERT, UPDATE, and DELETE policies for the user_roles table
-- Admins need the ability to manage user_roles for New Users, Editing roles, and Deleting roles.

CREATE POLICY "ur_insert" ON public.user_roles 
FOR INSERT TO authenticated 
WITH CHECK (public.su_is_admin());

CREATE POLICY "ur_update" ON public.user_roles 
FOR UPDATE TO authenticated 
USING (public.su_is_admin());

CREATE POLICY "ur_delete" ON public.user_roles 
FOR DELETE TO authenticated 
USING (public.su_is_admin());


-- FILE: 20260226260000_fix_admin_profile_access.sql
-- FIX: Allow Admins to manage all user profiles
-- Previously, the RLS policy only allowed users to update THEIR OWN profile.
-- These policies use the su_is_admin() helper to bypass recursion.

DROP POLICY IF EXISTS "p_select" ON public.profiles;
DROP POLICY IF EXISTS "p_insert" ON public.profiles;
DROP POLICY IF EXISTS "p_update" ON public.profiles;
DROP POLICY IF EXISTS "p_delete" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "p_select" ON public.profiles 
FOR SELECT TO authenticated 
USING (user_id = auth.uid() OR public.su_is_admin());

CREATE POLICY "p_insert" ON public.profiles 
FOR INSERT TO authenticated 
WITH CHECK (public.su_is_admin());

CREATE POLICY "p_update" ON public.profiles 
FOR UPDATE TO authenticated 
USING (user_id = auth.uid() OR public.su_is_admin());

CREATE POLICY "p_delete" ON public.profiles 
FOR DELETE TO authenticated 
USING (public.su_is_admin());


-- FILE: 20260226270000_fix_security_seeding.sql
-- FIX: Allow Admins to Seed and Manage Security Matrix
-- The previous policy used an undefined or recursive is_admin() function.
-- This update switches to the stable su_is_admin() helper.

DROP POLICY IF EXISTS "Admins manage permissions" ON public.permissions;
DROP POLICY IF EXISTS "Admins manage role_permissions" ON public.role_permissions;

CREATE POLICY "Admins manage permissions" ON public.permissions 
FOR ALL TO authenticated 
USING (public.su_is_admin())
WITH CHECK (public.su_is_admin());

CREATE POLICY "Admins manage role_permissions" ON public.role_permissions 
FOR ALL TO authenticated 
USING (public.su_is_admin())
WITH CHECK (public.su_is_admin());


-- FILE: 20260226300000_fix_batches_rls.sql
-- FIX BATCHES TABLE RLS
-- This migration ensures the batches table exists and has correct RLS policies using the is_admin() helper.

-- 1. Create Batches Table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    academic_year TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Anyone can view batches" ON public.batches;
DROP POLICY IF EXISTS "Admins manage batches" ON public.batches;
DROP POLICY IF EXISTS "Admins full batches" ON public.batches;
DROP POLICY IF EXISTS "Users view batches" ON public.batches;

-- 4. Create New Optimized Policies
-- Use the public.is_admin() wrapper which is already defined and safe
CREATE POLICY "Users view batches" ON public.batches 
FOR SELECT TO authenticated 
USING (true);

CREATE POLICY "Admins full batches" ON public.batches 
FOR ALL TO authenticated 
USING (public.is_admin());

-- 5. Ensure the profiles -> batches link is optimized if it exists
-- The Batches.tsx code does: .select('*, profiles(count)')
-- This implies batch is used in profiles.
-- Many parts of the app use 'batch' as a TEXT field currently.
-- We keep it as TEXT for compatibility but we need to make sure 
-- RLS on profiles doesn't block the count.

-- Refresh policies for profiles just in case
DROP POLICY IF EXISTS "Admin view all profiles" ON public.profiles;
CREATE POLICY "Admin view all profiles" ON public.profiles 
FOR SELECT TO authenticated 
USING (public.is_admin());


-- FILE: 20260226310000_fix_grades_rls.sql
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


-- FILE: 20260226350000_persistent_unread.sql
-- PERSISTENT UNREAD INDICATORS
-- This migration adds columns to track when a user last viewed a chat.

-- 1. For Direct Chats (Relationship-based)
ALTER TABLE public.chat_contacts ADD COLUMN IF NOT EXISTS user_last_read_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.chat_contacts ADD COLUMN IF NOT EXISTS contact_last_read_at TIMESTAMPTZ DEFAULT now();

-- 2. For Group Chats (Member-based)
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT now();

-- 3. Update RLS to allow users to update their own reading timestamps
-- They already have access to their own group_members and chat_contacts records.

-- 4. Utility function to mark as read
CREATE OR REPLACE FUNCTION public.mark_chat_as_read(chat_id UUID, is_group BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF is_group THEN
        UPDATE public.group_members 
        SET last_read_at = now()
        WHERE group_id = chat_id AND user_id = auth.uid();
    ELSE
        -- For direct chat, chat_id is the chat_contacts ID
        UPDATE public.chat_contacts
        SET user_last_read_at = CASE WHEN user_id = auth.uid() THEN now() ELSE user_last_read_at END,
            contact_last_read_at = CASE WHEN contact_id = auth.uid() THEN now() ELSE contact_last_read_at END
        WHERE id = chat_id AND (user_id = auth.uid() OR contact_id = auth.uid());
    END IF;
END;
$$;


-- FILE: 20260226360000_fix_announcements_rls.sql
-- FIX ANNOUNCEMENTS RLS POLICIES
-- This migration ensures that Admins and Lecturers can properly post and manage announcements.

-- 1. Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view relevant announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins and Lecturers manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admin full access subjects" ON public.announcements;

-- 3. SELECT: Anyone can view relevant announcements
-- Global announcements or those targeted to their subjects/departments/batches
CREATE POLICY "announcements_select" ON public.announcements
FOR SELECT TO authenticated
USING (
    target_type = 'global' OR
    public.is_admin() OR
    sender_id = auth.uid() OR
    (target_type = 'subject' AND EXISTS (
        SELECT 1 FROM public.enrollments 
        WHERE subject_id = announcements.subject_id AND student_id = auth.uid()
    )) OR
    (target_type = 'department' AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND department_id = announcements.department_id
    ))
);

-- 4. INSERT/UPDATE/DELETE: Admins and Lecturers
-- Admins have full control
CREATE POLICY "announcements_admin" ON public.announcements
FOR ALL TO authenticated
USING (public.is_admin());

-- Lecturers can manage their own announcements
CREATE POLICY "announcements_lecturer" ON public.announcements
FOR ALL TO authenticated
USING (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'lecturer'
))
WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'lecturer'
));


-- FILE: 20260226370000_fix_announcements_joins.sql
-- FIX ANNOUNCEMENTS RELATIONSHIPS
-- This migration updates announcements to link correctly with profiles for UI joins.

-- 1. Update Foreign Key to point to Profiles instead of Auth.Users
-- This allows the Supabase client to join with profile data (full_name, avatar) automatically.
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_sender_id_fkey;
ALTER TABLE public.announcements 
ADD CONSTRAINT announcements_sender_id_fkey 
FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- 2. Add an explicit foreign key for subjects if not present or named differently
-- (Helps with the subjects(name) join in the UI)
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_subject_id_fkey;
ALTER TABLE public.announcements 
ADD CONSTRAINT announcements_subject_id_fkey 
FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

-- 3. Add column for department_id and batch if missing (from earlier enterprise schema partials)
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS batch TEXT;


-- FILE: 20260226380000_fix_dm_subject_rls.sql
-- FIX DIRECT MESSAGES RLS FOR SUBJECT CHATS
-- This migration ensures that both students (enrolled) and lecturers (teaching) can see and send subject-specific messages.

-- 1. Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "whatsapp_message_access" ON public.direct_messages;
DROP POLICY IF EXISTS "whatsapp_message_insert" ON public.direct_messages;
DROP POLICY IF EXISTS "Users view own messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users send messages" ON public.direct_messages;
DROP POLICY IF EXISTS "dm_select" ON public.direct_messages;
DROP POLICY IF EXISTS "dm_send" ON public.direct_messages;

-- 3. SELECT: Comprehensive access
CREATE POLICY "dm_select_v2" ON public.direct_messages
FOR SELECT TO authenticated
USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR 
    public.is_admin() OR
    (group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members WHERE group_id = direct_messages.group_id AND user_id = auth.uid()
    )) OR
    (subject_id IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.enrollments WHERE subject_id = direct_messages.subject_id AND student_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.subjects WHERE id = direct_messages.subject_id AND lecturer_id = auth.uid())
    ))
);

-- 4. INSERT: Safe sending
CREATE POLICY "dm_insert_v2" ON public.direct_messages
FOR INSERT TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND (
        receiver_id IS NOT NULL OR 
        group_id IS NOT NULL OR
        (subject_id IS NOT NULL AND (
            EXISTS (SELECT 1 FROM public.enrollments WHERE subject_id = subject_id AND student_id = auth.uid()) OR
            EXISTS (SELECT 1 FROM public.subjects WHERE id = subject_id AND lecturer_id = auth.uid())
        ))
    )
);


-- FILE: 20260226390000_restrict_student_subjects.sql
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


-- FILE: fix_user_roles.sql
CREATE POLICY "ur_insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.su_is_admin()); CREATE POLICY "ur_update" ON public.user_roles FOR UPDATE TO authenticated USING (public.su_is_admin()); CREATE POLICY "ur_delete" ON public.user_roles FOR DELETE TO authenticated USING (public.su_is_admin());


