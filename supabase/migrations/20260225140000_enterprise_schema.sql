-- ENTERPRISE SCHEMA FOR SAMS (Smart Academic Management System)

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
