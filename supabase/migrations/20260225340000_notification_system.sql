-- NOTIFICATION SYSTEM
-- This system handles alerts for chat requests, grades, and system updates.

-- 1. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
    actor_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE, -- Who triggered the notification?
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('chat_request', 'grade_posted', 'announcement', 'system')),
    link TEXT, -- Optional URL or path to redirect
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 3. RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notifications"
ON public.notifications FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. Automation: Chat Request Notification
CREATE OR REPLACE FUNCTION public.notify_chat_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_name TEXT;
BEGIN
    -- Get Actor Name safely
    SELECT COALESCE(full_name, 'A peer') INTO actor_name FROM public.profiles WHERE user_id = NEW.user_id;

    IF (NEW.status = 'pending') THEN
        INSERT INTO public.notifications (user_id, actor_id, title, content, type, link)
        VALUES (
            NEW.contact_id, 
            NEW.user_id, 
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
  AFTER INSERT ON public.chat_contacts
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.notify_chat_request();

-- 5. Automation: Acceptance Notification
CREATE OR REPLACE FUNCTION public.notify_chat_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_id UUID := auth.uid();
    target_id UUID;
    actor_name TEXT;
BEGIN
    -- Only proceed if status flipped from pending to accepted
    IF (NEW.status = 'accepted' AND OLD.status = 'pending') THEN
        -- Safely get actor's name
        SELECT COALESCE(full_name, 'A peer') INTO actor_name FROM public.profiles WHERE user_id = actor_id;

        -- Identify who we are notifying (the person who DID NOT accept)
        IF (NEW.user_id = actor_id) THEN
            target_id := NEW.contact_id;
        ELSE
            target_id := NEW.user_id;
        END IF;

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
  WHEN (NEW.status = 'accepted' AND OLD.status = 'pending')
  EXECUTE FUNCTION public.notify_chat_acceptance();
