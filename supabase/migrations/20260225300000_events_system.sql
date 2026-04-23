-- EVENTS SYSTEM
-- 1. Ensure Events Table and Columns exist
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    location TEXT,
    image_url TEXT,
    category TEXT DEFAULT 'General',
    is_published BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add/Modify columns to match the required schema
DO $$ 
BEGIN 
    -- Drop NOT NULL from created_by if it exists
    ALTER TABLE public.events ALTER COLUMN created_by DROP NOT NULL;

    -- Add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='image_url') THEN
        ALTER TABLE public.events ADD COLUMN image_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='category') THEN
        ALTER TABLE public.events ADD COLUMN category TEXT DEFAULT 'General';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='is_published') THEN
        ALTER TABLE public.events ADD COLUMN is_published BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 2. Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Anyone can view published events" ON public.events;
CREATE POLICY "Anyone can view published events" 
ON public.events 
FOR SELECT 
TO authenticated 
USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
CREATE POLICY "Admins can manage events" 
ON public.events 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Sample Data
INSERT INTO public.events (title, description, event_date, location, category)
VALUES 
('Annual Tech Symposium 2024', 'A gathering of innovators and tech enthusiasts to showcase projects and attend workshops.', '2024-10-15 09:00:00+00', 'Main Auditorium', 'Academic'),
('Inter-Batch Cricket Tournament', 'The much-awaited annual sports event where batches compete for the trophy.', '2024-11-05 08:30:00+00', 'Campus Grounds', 'Sports'),
('Freshers Welcome 2024', 'A night of music, dance, and networking to welcome the new cohort.', '2024-09-20 18:00:00+00', 'Grand Hall', 'Cultural')
ON CONFLICT DO NOTHING;
