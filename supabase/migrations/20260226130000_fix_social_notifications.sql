-- ENHANCED NOTIFICATION TRIGGERS
-- Fixes issues where notifications wouldn't "pop" or send on status updates.

-- 1. Improved Chat Request Notification (Handles Insert & Update)
CREATE OR REPLACE FUNCTION public.notify_chat_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_name TEXT;
BEGIN
    -- Only fire if status is pending (New request or re-request)
    IF (NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending')) THEN
        
        -- The actor is the person who initiated/updated the record (NEW.user_id)
        SELECT COALESCE(full_name, 'A peer') INTO actor_name FROM public.profiles WHERE user_id = NEW.user_id;

        INSERT INTO public.notifications (user_id, actor_id, title, content, type, link)
        VALUES (
            NEW.contact_id, -- Notify the receiver
            NEW.user_id,    -- The sender is the actor
            'New Chat Request', 
            actor_name || ' wants to connect with you.',
            'chat_request',
            '/groups'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_chat_request ON public.chat_contacts;
CREATE TRIGGER tr_notify_chat_request
  AFTER INSERT OR UPDATE OF status ON public.chat_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_request();

-- 2. Improved Acceptance Notification
CREATE OR REPLACE FUNCTION public.notify_chat_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_id UUID;
    target_id UUID;
    actor_name TEXT;
BEGIN
    -- Only proceed if status flipped from pending to accepted
    IF (NEW.status = 'accepted' AND OLD.status = 'pending') THEN
        
        -- The person who accepted is the 'contact_id' in a standard flow
        -- But to be safe, we assume the CURRENT USER is the actor
        actor_id := auth.uid();
        
        -- Fallback: if auth.uid() is null (e.g. system action), we assume contact_id accepted
        IF actor_id IS NULL THEN
            actor_id := NEW.contact_id;
        END IF;

        -- Identify who we are notifying (the person who DID NOT perform the action)
        IF (NEW.user_id = actor_id) THEN
            target_id := NEW.contact_id;
        ELSE
            target_id := NEW.user_id;
        END IF;

        -- Get actor's name
        SELECT COALESCE(full_name, 'A peer') INTO actor_name FROM public.profiles WHERE user_id = actor_id;

        INSERT INTO public.notifications (user_id, actor_id, title, content, type, link)
        VALUES (
            target_id,
            actor_id,
            'Request Accepted', 
            actor_name || ' accepted your chat request!',
            'chat_request',
            '/groups'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_chat_acceptance ON public.chat_contacts;
CREATE TRIGGER tr_notify_chat_acceptance
  AFTER UPDATE OF status ON public.chat_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_acceptance();
