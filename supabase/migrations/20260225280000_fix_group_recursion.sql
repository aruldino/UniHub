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
