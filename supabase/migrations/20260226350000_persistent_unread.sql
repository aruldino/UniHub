-- PERSISTENT UNREAD INDICATORS
-- This migration adds columns to track when a user last viewed a chat.

-- 1. For Direct Chats (Relationship-based)
ALTER TABLE public.chat_contacts ADD COLUMN IF NOT EXISTS user_last_read_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.chat_contacts ADD COLUMN IF NOT EXISTS contact_last_read_at TIMESTAMPTZ DEFAULT now();

-- 2. For Group Chats (Member-based)
ALTER TABLE public.group_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT now();

-- 3. Update RLS to allow users to update their own reading timestamps
-- They already have access to their own group_members and chat_contacts records.

-- 4. Utility function to mark as read
CREATE OR REPLACE FUNCTION public.mark_chat_as_read(chat_id UUID, is_group BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF is_group THEN
        UPDATE public.group_members 
        SET last_read_at = now()
        WHERE group_id = chat_id AND user_id = auth.uid();
    ELSE
        -- For direct chat, chat_id is the chat_contacts ID
        UPDATE public.chat_contacts
        SET user_last_read_at = CASE WHEN user_id = auth.uid() THEN now() ELSE user_last_read_at END,
            contact_last_read_at = CASE WHEN contact_id = auth.uid() THEN now() ELSE contact_last_read_at END
        WHERE id = chat_id AND (user_id = auth.uid() OR contact_id = auth.uid());
    END IF;
END;
$$;
