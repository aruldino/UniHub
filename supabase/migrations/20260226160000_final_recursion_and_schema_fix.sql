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
