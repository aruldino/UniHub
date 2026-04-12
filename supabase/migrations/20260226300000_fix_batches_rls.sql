-- FIX BATCHES TABLE RLS
-- This migration ensures the batches table exists and has correct RLS policies using the is_admin() helper.

-- 1. Create Batches Table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    academic_year TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Anyone can view batches" ON public.batches;
DROP POLICY IF EXISTS "Admins manage batches" ON public.batches;
DROP POLICY IF EXISTS "Admins full batches" ON public.batches;
DROP POLICY IF EXISTS "Users view batches" ON public.batches;

-- 4. Create New Optimized Policies
-- Use the public.is_admin() wrapper which is already defined and safe
CREATE POLICY "Users view batches" ON public.batches 
FOR SELECT TO authenticated 
USING (true);

CREATE POLICY "Admins full batches" ON public.batches 
FOR ALL TO authenticated 
USING (public.is_admin());

-- 5. Ensure the profiles -> batches link is optimized if it exists
-- The Batches.tsx code does: .select('*, profiles(count)')
-- This implies batch is used in profiles.
-- Many parts of SAMS use 'batch' as a TEXT field currently.
-- We keep it as TEXT for compatibility but we need to make sure 
-- RLS on profiles doesn't block the count.

-- Refresh policies for profiles just in case
DROP POLICY IF EXISTS "Admin view all profiles" ON public.profiles;
CREATE POLICY "Admin view all profiles" ON public.profiles 
FOR SELECT TO authenticated 
USING (public.is_admin());
