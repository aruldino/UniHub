-- SAMS REPAIR 2026-02-26: FINAL ATOMIC FIX
-- This script fixes the 400 (POST error), 500 (Recursion), and Notifications.

-- 1. FIX NOTIFICATIONS SCHEMA FIRST (Triggers depend on this)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- 2. RESET SECURITY & BREAK RECURSION LOOPS
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages DISABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('user_roles', 'groups', 'group_members', 'notifications', 'chat_contacts', 'direct_messages')) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3. BYPASS FUNCTIONS (Guaranteed Non-Recursive)
CREATE OR REPLACE FUNCTION public.su_is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'); END; $$;

CREATE OR REPLACE FUNCTION public.su_my_groups()
RETURNS UUID[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN ARRAY(SELECT group_id FROM public.group_members WHERE user_id = auth.uid()); END; $$;

-- 4. CLEAN POLICIES
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ur_final" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.su_is_admin());

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "g_final" ON public.groups FOR SELECT TO authenticated USING (id = ANY(public.su_my_groups()) OR public.su_is_admin());

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gm_final" ON public.group_members FOR SELECT TO authenticated USING (group_id = ANY(public.su_my_groups()) OR public.su_is_admin());

ALTER TABLE public.chat_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_final" ON public.chat_contacts FOR ALL TO authenticated USING (user_id = auth.uid() OR contact_id = auth.uid()) WITH CHECK (user_id = auth.uid() OR contact_id = auth.uid());

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "n_final" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_final" ON public.direct_messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR group_id = ANY(public.su_my_groups()));
CREATE POLICY "dm_send" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- 5. FIX NOTIFICATION TRIGGERS (Use correct column 'message')
CREATE OR REPLACE FUNCTION public.notify_chat_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_name TEXT;
BEGIN
    IF (NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending')) THEN
        SELECT COALESCE(full_name, 'A peer') INTO actor_name FROM public.profiles WHERE user_id = NEW.user_id;
        INSERT INTO public.notifications (user_id, actor_id, title, message, type, link)
        VALUES (NEW.contact_id, NEW.user_id, 'New Chat Request', actor_name || ' wants to connect.', 'chat_request', '/groups');
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER tr_notify_chat_request AFTER INSERT OR UPDATE OF status ON public.chat_contacts FOR EACH ROW EXECUTE FUNCTION public.notify_chat_request();

CREATE OR REPLACE FUNCTION public.notify_chat_acceptance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_id UUID; target_id UUID; actor_name TEXT;
BEGIN
    IF (NEW.status = 'accepted' AND OLD.status = 'pending') THEN
        actor_id := auth.uid();
        IF actor_id IS NULL THEN actor_id := NEW.contact_id; END IF;
        IF (NEW.user_id = actor_id) THEN target_id := NEW.contact_id; ELSE target_id := NEW.user_id; END IF;
        SELECT COALESCE(full_name, 'A peer') INTO actor_name FROM public.profiles WHERE user_id = actor_id;
        INSERT INTO public.notifications (user_id, actor_id, title, message, type, link)
        VALUES (target_id, actor_id, 'Request Accepted', actor_name || ' accepted your request!', 'chat_request', '/groups');
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER tr_notify_chat_acceptance AFTER UPDATE OF status ON public.chat_contacts FOR EACH ROW EXECUTE FUNCTION public.notify_chat_acceptance();

-- 6. FIX AMBIGUITY (The 400/500 query Fix)
ALTER TABLE public.chat_contacts DROP CONSTRAINT IF EXISTS chat_contacts_user_id_fkey;
ALTER TABLE public.chat_contacts ADD CONSTRAINT chat_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.chat_contacts DROP CONSTRAINT IF EXISTS chat_contacts_contact_id_fkey;
ALTER TABLE public.chat_contacts ADD CONSTRAINT chat_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_actor_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
