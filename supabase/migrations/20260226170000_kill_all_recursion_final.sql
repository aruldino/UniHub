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
