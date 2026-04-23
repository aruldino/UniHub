-- SOCIAL HUB UI BOOST: MESSAGE PREVIEWS & UNREAD INDICATORS
-- This script adds last_message_content and last_read_at for a premium WhatsApp-like experience.

-- 1. Add Columns for Previews and Sync
ALTER TABLE public.chat_contacts ADD COLUMN IF NOT EXISTS last_message_content TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS last_message_content TEXT;

-- 2. Update the Sync Trigger to include the content
CREATE OR REPLACE FUNCTION public.sync_last_message_time()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Update Direct Chat contact timestamp and preview
    IF NEW.receiver_id IS NOT NULL THEN
        UPDATE public.chat_contacts 
        SET 
            last_message_at = NEW.created_at,
            last_message_content = CASE 
                WHEN length(NEW.content) > 30 THEN left(NEW.content, 27) || '...'
                ELSE NEW.content 
            END
        WHERE (user_id = NEW.sender_id AND contact_id = NEW.receiver_id) 
           OR (user_id = NEW.receiver_id AND contact_id = NEW.sender_id);
    END IF;
    
    -- Update Group Chat timestamp and preview
    IF NEW.group_id IS NOT NULL THEN
        UPDATE public.groups 
        SET 
            last_message_at = NEW.created_at,
            last_message_content = CASE 
                WHEN length(NEW.content) > 30 THEN left(NEW.content, 27) || '...'
                ELSE NEW.content 
            END
        WHERE id = NEW.group_id;
    END IF;
    
    RETURN NEW;
END; $$;

-- 3. Initial Sync for existing messages
UPDATE public.chat_contacts c
SET 
  last_message_at = m.created_at,
  last_message_content = left(m.content, 30)
FROM (
  SELECT DISTINCT ON (thread_id) 
    created_at, content, 
    COALESCE(group_id, (CASE WHEN sender_id < receiver_id THEN sender_id || receiver_id ELSE receiver_id || sender_id END)::uuid) as thread_id
  FROM public.direct_messages
  ORDER BY thread_id, created_at DESC
) m
WHERE last_message_at IS NULL;
