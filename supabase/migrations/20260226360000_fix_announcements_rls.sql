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
