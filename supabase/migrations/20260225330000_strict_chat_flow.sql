-- CHAT SYSTEM REFINEMENT
-- 1. Update Profiles Policy to allow searching for all users
-- This allows the "Find a Peer" feature to work across the whole campus
DROP POLICY IF EXISTS "Profiles_Base_Policy" ON public.profiles;
CREATE POLICY "Profiles_Base_Policy" ON public.profiles FOR SELECT 
  USING (
    user_id = auth.uid() OR 
    public.is_admin() OR
    department_id = public.get_my_department() OR
    auth.uid() IS NOT NULL -- Allow all authenticated users to see basic profile info
  );

-- 2. Update Direct Messages Policy to require 'accepted' status for 1-on-1s
-- This enforces the "Request/Accept" flow at the database level
DROP POLICY IF EXISTS "whatsapp_message_insert" ON public.direct_messages;

CREATE POLICY "strict_chat_insert_policy"
ON public.direct_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND (
        -- Group messages: Check membership
        (group_id IS NOT NULL AND public.check_group_membership(group_id, auth.uid())) OR
        -- Subject messages: Lecturer to subject
        (subject_id IS NOT NULL AND public.is_lecturer_of_subject(subject_id)) OR
        -- 1-on-1 messages: Must be 'accepted' in chat_contacts
        (receiver_id IS NOT NULL AND (
            public.is_admin() OR -- Admins can bypass for support/moderation
            EXISTS (
                SELECT 1 FROM public.chat_contacts
                WHERE (
                    (user_id = auth.uid() AND contact_id = receiver_id AND status = 'accepted') OR
                    (user_id = receiver_id AND contact_id = auth.uid() AND status = 'accepted')
                )
            )
        ))
    )
);

-- 3. Add column to profiles for bio/phone if they don't exist (Enterprise extension)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
