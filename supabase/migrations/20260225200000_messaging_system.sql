-- MESSAGING & ANNOUNCEMENT SYSTEM

-- 1. Announcements Table (Broadcasts)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('global', 'subject', 'department', 'batch')),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    batch TEXT,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Announcement Tracking (Who read what)
CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    read_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(announcement_id, user_id)
);

-- 3. Direct Messages (1-to-1 or group context)
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Null for group-context messages if needed
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE, -- Context: "Lecturer to subject students"
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- 5. RLS POLICIES
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Announcements: Anyone can read relevant announcements
CREATE POLICY "Users can view relevant announcements" 
ON public.announcements FOR SELECT 
TO authenticated 
USING (
    target_type = 'global' OR
    (target_type = 'subject' AND EXISTS (SELECT 1 FROM public.enrollments WHERE subject_id = announcements.subject_id AND student_id = auth.uid())) OR
    (target_type = 'subject' AND EXISTS (SELECT 1 FROM public.subjects WHERE id = announcements.subject_id AND lecturer_id = auth.uid())) OR
    (public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins and Lecturers manage announcements" 
ON public.announcements FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'lecturer'));

-- Announcement Reads: Users manage own read status
CREATE POLICY "Users manage own announcement reads" 
ON public.announcement_reads FOR ALL 
TO authenticated 
USING (user_id = auth.uid());

-- Direct Messages: Private access
CREATE POLICY "Users view own messages" 
ON public.direct_messages FOR SELECT 
TO authenticated 
USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR 
    (subject_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.enrollments WHERE subject_id = direct_messages.subject_id AND student_id = auth.uid()
    ))
);

CREATE POLICY "Users send messages" 
ON public.direct_messages FOR INSERT 
TO authenticated 
WITH CHECK (sender_id = auth.uid());

-- 6. Trigger for updated_at
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
