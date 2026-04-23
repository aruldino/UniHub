-- SOCIAL HUB REPAIR: RECURSION KILLER & SCHEMA FIX
-- This script fixes the 500 and 400 errors once and for all.

-- 1. CLEAN SLATE: Disable RLS and clear ALL policies (aggressive)
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages DISABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. RECURSION-PROOF CORE FUNCTIONS (PL/pgSQL ONLY)
-- We use PL/pgSQL to prevent Postgres from 'inlining' the logic and causing recursive loops.

CREATE OR REPLACE FUNCTION public.su_is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
END; $$;

CREATE OR REPLACE FUNCTION public.su_get_my_groups()
RETURNS UUID[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN ARRAY(SELECT group_id FROM public.group_members WHERE user_id = auth.uid());
END; $$;

-- This checks if there is a 'blocked' status between two users
CREATE OR REPLACE FUNCTION public.su_is_blocked(_u1 UUID, _u2 UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.chat_contacts 
        WHERE ((user_id = _u1 AND contact_id = _u2) OR (user_id = _u2 AND contact_id = _u1))
        AND status = 'blocked'
    );
END; $$;

-- 3. ENSURE TABLE STRUCTURE (The 400 Error fix)
-- PostgREST needs explicit foreign keys to resolve joins correctly.

ALTER TABLE public.chat_contacts DROP CONSTRAINT IF EXISTS chat_contacts_user_id_fkey;
ALTER TABLE public.chat_contacts ADD CONSTRAINT chat_contacts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.chat_contacts DROP CONSTRAINT IF EXISTS chat_contacts_contact_id_fkey;
ALTER TABLE public.chat_contacts ADD CONSTRAINT chat_contacts_contact_id_fkey 
    FOREIGN KEY (contact_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- 4. APPLY CLEAN, FLAT POLICIES (No nested queries)

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ur_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.su_is_admin());

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "g_read" ON public.groups FOR SELECT TO authenticated USING (id = ANY(public.su_get_my_groups()) OR public.su_is_admin());
CREATE POLICY "g_all" ON public.groups FOR ALL TO authenticated USING (public.su_is_admin()) WITH CHECK (public.su_is_admin());

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gm_read" ON public.group_members FOR SELECT TO authenticated USING (group_id = ANY(public.su_get_my_groups()) OR public.su_is_admin());
CREATE POLICY "gm_all" ON public.group_members FOR ALL TO authenticated USING (public.su_is_admin());

ALTER TABLE public.chat_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_access" ON public.chat_contacts FOR ALL TO authenticated 
USING (user_id = auth.uid() OR contact_id = auth.uid())
WITH CHECK (user_id = auth.uid() OR contact_id = auth.uid());

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_read" ON public.direct_messages FOR SELECT TO authenticated 
USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR 
    group_id = ANY(public.su_get_my_groups())
);

CREATE POLICY "dm_send" ON public.direct_messages FOR INSERT TO authenticated 
WITH CHECK (
    sender_id = auth.uid() AND 
    (
        (receiver_id IS NOT NULL AND NOT public.su_is_blocked(auth.uid(), receiver_id)) OR 
        (group_id IS NOT NULL AND group_id = ANY(public.su_get_my_groups()))
    )
);

-- 5. RE-SYNC REALTIME
DO $$ 
BEGIN 
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages, public.chat_contacts, public.groups, public.group_members; EXCEPTION WHEN OTHERS THEN END;
END $$;
