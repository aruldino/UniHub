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
