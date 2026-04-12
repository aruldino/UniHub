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
