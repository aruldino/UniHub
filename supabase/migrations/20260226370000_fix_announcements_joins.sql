-- FIX ANNOUNCEMENTS RELATIONSHIPS
-- This migration updates announcements to link correctly with profiles for UI joins.

-- 1. Update Foreign Key to point to Profiles instead of Auth.Users
-- This allows the Supabase client to join with profile data (full_name, avatar) automatically.
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_sender_id_fkey;
ALTER TABLE public.announcements 
ADD CONSTRAINT announcements_sender_id_fkey 
FOREIGN KEY (sender_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- 2. Add an explicit foreign key for subjects if not present or named differently
-- (Helps with the subjects(name) join in the UI)
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_subject_id_fkey;
ALTER TABLE public.announcements 
ADD CONSTRAINT announcements_subject_id_fkey 
FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

-- 3. Add column for department_id and batch if missing (from earlier enterprise schema partials)
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS batch TEXT;
