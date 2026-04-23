-- SOCIAL HUB REAL-TIME ALERTS: NEW MESSAGE NOTIFICATIONS
-- This script ensures that when you get a message, a notification is created so you get the "Pop" alert.

-- 1. Create the Message Notification function
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    sender_name TEXT;
BEGIN
    -- Only notify for direct messages (not group for now to avoid spam, or add group logic)
    IF NEW.receiver_id IS NOT NULL THEN
        -- Get the sender's name
        SELECT COALESCE(full_name, 'A peer') INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;

        -- Insert a notification for the receiver
        INSERT INTO public.notifications (user_id, actor_id, title, message, type, link)
        VALUES (
            NEW.receiver_id, 
            NEW.sender_id,
            'New Message', 
            sender_name || ': ' || (CASE WHEN length(NEW.content) > 30 THEN left(NEW.content, 27) || '...' ELSE NEW.content END),
            'message',
            '/groups'
        );
    END IF;

    -- For Groups (Notify all members except the sender)
    IF NEW.group_id IS NOT NULL THEN
        SELECT COALESCE(full_name, 'A peer') INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;

        INSERT INTO public.notifications (user_id, actor_id, title, message, type, link)
        SELECT 
            user_id, 
            NEW.sender_id, 
            'New Group Message', 
            sender_name || ' in Group: ' || (CASE WHEN length(NEW.content) > 30 THEN left(NEW.content, 27) || '...' ELSE NEW.content END),
            'message',
            '/groups'
        FROM public.group_members 
        WHERE group_id = NEW.group_id AND user_id != NEW.sender_id;
    END IF;

    RETURN NEW;
END; $$;

-- 2. Attach the trigger
DROP TRIGGER IF EXISTS tr_notify_new_message ON public.direct_messages;
CREATE TRIGGER tr_notify_new_message
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();
