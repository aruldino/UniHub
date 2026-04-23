-- ENTERPRISE TIMETABLE & SCHEDULING SYSTEM

-- 1. Enable Extension for Conflict Prevention (Exclusion Constraints)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Enhance Timetable Table
ALTER TABLE public.timetable 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS batch TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Add Conflict Prevention (Exclusion Constraint)
-- This prevents overlapping times for the same ROOM on the same DAY
ALTER TABLE public.timetable 
ADD CONSTRAINT room_time_conflict EXCLUDE USING gist (
    room WITH =,
    day_of_week WITH =,
    tsrange(
        ('1970-01-01'::date + start_time)::timestamp,
        ('1970-01-01'::date + end_time)::timestamp
    ) WITH &&
);

-- This prevents overlapping times for the same BATCH + DEPT on the same DAY
-- (Students can't be in two places at once)
ALTER TABLE public.timetable 
ADD CONSTRAINT batch_time_conflict EXCLUDE USING gist (
    batch WITH =,
    department_id WITH =,
    day_of_week WITH =,
    tsrange(
        ('1970-01-01'::date + start_time)::timestamp,
        ('1970-01-01'::date + end_time)::timestamp
    ) WITH &&
);

-- 4. RLS POLICIES FOR TIMETABLE
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view timetable" ON public.timetable;
DROP POLICY IF EXISTS "Admins can manage timetable" ON public.timetable;

-- Admin: Full Control
CREATE POLICY "Admins full control timetable" 
ON public.timetable FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Lecturers: View assigned subjects' timetable
CREATE POLICY "Lecturers view assigned timetable" 
ON public.timetable FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.subjects 
        WHERE id = subject_id AND lecturer_id = auth.uid()
    )
);

-- Students: View relevant filtered timetable
CREATE POLICY "Students view filtered timetable" 
ON public.timetable FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND (profiles.department_id = timetable.department_id OR timetable.department_id IS NULL)
        AND (profiles.batch = timetable.batch OR timetable.batch IS NULL)
    )
);

-- 5. Trigger for updated_at
CREATE TRIGGER update_timetable_updated_at 
BEFORE UPDATE ON public.timetable 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
