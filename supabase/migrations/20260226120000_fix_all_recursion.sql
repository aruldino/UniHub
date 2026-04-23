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
