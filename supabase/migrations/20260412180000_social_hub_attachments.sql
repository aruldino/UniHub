-- Social Hub: file attachments (any type; size limit enforced by bucket + app)

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT;

ALTER TABLE public.direct_messages
  ALTER COLUMN content SET DEFAULT '';

-- At least text or an attachment
ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_content_or_attachment_chk;
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_content_or_attachment_chk
  CHECK (
    (length(trim(COALESCE(content, ''))) > 0)
    OR (attachment_path IS NOT NULL AND length(trim(attachment_path)) > 0)
  );

-- Private bucket (50MB max per object; types not restricted)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-media', 'chat-media', false, 52428800)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "chat_media_insert_own" ON storage.objects;
CREATE POLICY "chat_media_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "chat_media_select_auth" ON storage.objects;
CREATE POLICY "chat_media_select_auth"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat_media_delete_own" ON storage.objects;
CREATE POLICY "chat_media_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Sidebar / group preview text for attachments
CREATE OR REPLACE FUNCTION public.sync_last_message_time()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  preview TEXT;
BEGIN
  preview := CASE
    WHEN NEW.attachment_path IS NOT NULL AND length(trim(NEW.attachment_path)) > 0 THEN
      CASE
        WHEN NEW.attachment_mime IS NOT NULL AND NEW.attachment_mime LIKE 'image/%' THEN
          COALESCE(NULLIF(trim(NEW.content), ''), '📷 Photo')
        ELSE
          '📎 ' || COALESCE(NULLIF(trim(NEW.attachment_name), ''), 'File')
      END
    ELSE
      CASE
        WHEN length(COALESCE(NEW.content, '')) > 30 THEN left(NEW.content, 27) || '...'
        ELSE COALESCE(NEW.content, '')
      END
  END;

  IF NEW.receiver_id IS NOT NULL THEN
    UPDATE public.chat_contacts
    SET
      last_message_at = NEW.created_at,
      last_message_content = left(preview, 200)
    WHERE (user_id = NEW.sender_id AND contact_id = NEW.receiver_id)
       OR (user_id = NEW.receiver_id AND contact_id = NEW.sender_id);
  END IF;

  IF NEW.group_id IS NOT NULL THEN
    UPDATE public.groups
    SET
      last_message_at = NEW.created_at,
      last_message_content = left(preview, 200)
    WHERE id = NEW.group_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_name TEXT;
  preview TEXT;
BEGIN
  preview := CASE
    WHEN NEW.attachment_path IS NOT NULL AND length(trim(NEW.attachment_path)) > 0 THEN
      CASE
        WHEN NEW.attachment_mime IS NOT NULL AND NEW.attachment_mime LIKE 'image/%' THEN
          COALESCE(NULLIF(trim(NEW.content), ''), '📷 Photo')
        ELSE
          '📎 ' || COALESCE(NULLIF(trim(NEW.attachment_name), ''), 'File')
      END
    ELSE
      CASE
        WHEN length(COALESCE(NEW.content, '')) > 30 THEN left(NEW.content, 27) || '...'
        ELSE COALESCE(NEW.content, '')
      END
  END;

  IF NEW.receiver_id IS NOT NULL THEN
    SELECT COALESCE(full_name, 'A peer') INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
    INSERT INTO public.notifications (user_id, actor_id, title, message, type, link)
    VALUES (
      NEW.receiver_id,
      NEW.sender_id,
      'New Message',
      sender_name || ': ' || left(preview, 120),
      'message',
      '/groups'
    );
  END IF;

  IF NEW.group_id IS NOT NULL THEN
    SELECT COALESCE(full_name, 'A peer') INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
    INSERT INTO public.notifications (user_id, actor_id, title, message, type, link)
    SELECT
      user_id,
      NEW.sender_id,
      'New Group Message',
      sender_name || ' in Group: ' || left(preview, 100),
      'message',
      '/groups'
    FROM public.group_members
    WHERE group_id = NEW.group_id AND user_id != NEW.sender_id;
  END IF;

  RETURN NEW;
END;
$$;
