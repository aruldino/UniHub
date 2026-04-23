-- FIX DIRECT MESSAGES RLS FOR SUBJECT CHATS
-- This migration ensures that both students (enrolled) and lecturers (teaching) can see and send subject-specific messages.

-- 1. Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "whatsapp_message_access" ON public.direct_messages;
DROP POLICY IF EXISTS "whatsapp_message_insert" ON public.direct_messages;
DROP POLICY IF EXISTS "Users view own messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users send messages" ON public.direct_messages;
DROP POLICY IF EXISTS "dm_select" ON public.direct_messages;
DROP POLICY IF EXISTS "dm_send" ON public.direct_messages;

-- 3. SELECT: Comprehensive access
CREATE POLICY "dm_select_v2" ON public.direct_messages
FOR SELECT TO authenticated
USING (
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR 
    public.is_admin() OR
    (group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members WHERE group_id = direct_messages.group_id AND user_id = auth.uid()
    )) OR
    (subject_id IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.enrollments WHERE subject_id = direct_messages.subject_id AND student_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.subjects WHERE id = direct_messages.subject_id AND lecturer_id = auth.uid())
    ))
);

-- 4. INSERT: Safe sending
CREATE POLICY "dm_insert_v2" ON public.direct_messages
FOR INSERT TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND (
        receiver_id IS NOT NULL OR 
        group_id IS NOT NULL OR
        (subject_id IS NOT NULL AND (
            EXISTS (SELECT 1 FROM public.enrollments WHERE subject_id = subject_id AND student_id = auth.uid()) OR
            EXISTS (SELECT 1 FROM public.subjects WHERE id = subject_id AND lecturer_id = auth.uid())
        ))
    )
);
