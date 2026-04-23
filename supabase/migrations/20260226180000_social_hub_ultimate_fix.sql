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
