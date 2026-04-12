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
