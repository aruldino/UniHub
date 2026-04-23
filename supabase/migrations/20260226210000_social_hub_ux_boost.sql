-- SOCIAL HUB PERFORMANCE & UX ENHANCEMENT
-- This script adds a 'last_message_at' field for instant sorting and unread indicators.

-- 1. Update Tables
ALTER TABLE public.chat_contacts ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now();

-- 2. Create Trigger Function to update these timestamps
CREATE OR REPLACE FUNCTION public.sync_last_message_time()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- For Direct Chats
    IF NEW.receiver_id IS NOT NULL THEN
        UPDATE public.chat_contacts 
        SET last_message_at = NEW.created_at
        WHERE (user_id = NEW.sender_id AND contact_id = NEW.receiver_id)
           OR (user_id = NEW.receiver_id AND contact_id = NEW.sender_id);
    END IF;

    -- For Group Chats
    IF NEW.group_id IS NOT NULL THEN
        UPDATE public.groups 
        SET last_message_at = NEW.created_at
        WHERE id = NEW.group_id;
    END IF;

    RETURN NEW;
END; $$;

-- 3. Attach Trigger
DROP TRIGGER IF EXISTS tr_sync_last_message_time ON public.direct_messages;
CREATE TRIGGER tr_sync_last_message_time
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.sync_last_message_time();

-- 4. Re-sync existing data (Best effort)
UPDATE public.chat_contacts c
SET last_message_at = (
    SELECT MAX(created_at) 
    FROM public.direct_messages 
    WHERE (sender_id = c.user_id AND receiver_id = c.contact_id)
       OR (sender_id = c.contact_id AND receiver_id = c.user_id)
)
WHERE EXISTS (
    SELECT 1 FROM public.direct_messages 
    WHERE (sender_id = c.user_id AND receiver_id = c.contact_id)
       OR (sender_id = c.contact_id AND receiver_id = c.user_id)
);

UPDATE public.groups g
SET last_message_at = (
    SELECT MAX(created_at) 
    FROM public.direct_messages 
    WHERE group_id = g.id
)
WHERE EXISTS (
    SELECT 1 FROM public.direct_messages 
    WHERE group_id = g.id
);
