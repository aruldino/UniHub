-- WHATSAPP-LIKE 1-ON-1 AND BLOCKING SYSTEM
-- Reference profiles(user_id) for easier joining in Supabase client

-- 1. Fix direct_messages foreign keys for automatic joining
ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_sender_id_fkey;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_receiver_id_fkey;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- 2. Chat Contacts / Relationships (The Request/Accept/Block Logic)
CREATE TABLE IF NOT EXISTS public.chat_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
    contact_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, contact_id)
);

-- 3. RLS for Chat Contacts
ALTER TABLE public.chat_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
ON public.chat_contacts FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR contact_id = auth.uid());

CREATE POLICY "Users can manage their contacts"
ON public.chat_contacts FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- 4. Unified Messages View/Policy update
-- We need to ensure blockers can't send/receive messages
CREATE OR REPLACE FUNCTION public.is_blocked(_user_id UUID, _contact_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.chat_contacts 
        WHERE (user_id = _user_id AND contact_id = _contact_id AND status = 'blocked')
           OR (user_id = _contact_id AND contact_id = _user_id AND status = 'blocked')
    );
$$;

-- 5. Updated Message Policy (Strictly Enforcement)
DROP POLICY IF EXISTS "Safe view messages" ON public.direct_messages;

CREATE POLICY "whatsapp_message_access"
ON public.direct_messages FOR SELECT
TO authenticated
USING (
    (sender_id = auth.uid() OR receiver_id = auth.uid()) OR 
    (group_id IS NOT NULL AND public.check_group_membership(group_id, auth.uid())) OR
    (subject_id IS NOT NULL AND public.is_student_enrolled(subject_id))
);

CREATE POLICY "whatsapp_message_insert"
ON public.direct_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND (
        (receiver_id IS NOT NULL AND NOT public.is_blocked(auth.uid(), receiver_id)) OR
        (group_id IS NOT NULL AND public.check_group_membership(group_id, auth.uid())) OR
        (subject_id IS NOT NULL AND public.is_lecturer_of_subject(subject_id)) -- Lecturer to subject
    )
);

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_contacts;
