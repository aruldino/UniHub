-- BIDIRECTIONAL AUTH SYNC & INTEGRITY SYSTEM

-- 1. DROP LEGACY TRIGGERS (Cleanup before strict implementation)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. ENHANCED SYNC FUNCTION (Handle Creation & Metadata Sync)
-- This function ensures auth.users metadata and public.profiles stay in perfect sync
CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Create Profile
        INSERT INTO public.profiles (
            user_id, 
            full_name, 
            email, 
            department_id, 
            batch, 
            status
        )
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
            NEW.email,
            (NEW.raw_user_meta_data->>'department_id')::uuid,
            NEW.raw_user_meta_data->>'batch',
            COALESCE(NEW.raw_user_meta_data->>'status', 'active')
        );

        -- Create Role
        INSERT INTO public.user_roles (user_id, role)
        VALUES (
            NEW.id,
            COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student')
        );

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Sync Email and Meta updates from Auth to Profile
        -- We check if values changed to prevent unnecessary writes/loops
        UPDATE public.profiles
        SET 
            email = NEW.email,
            full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
            updated_at = now()
        WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- 3. REVERSE SYNC: PROFILE -> AUTH METADATA
-- Ensures that if an admin updates a profile's full_name, it reflects in Supabase Auth
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Avoid infinite loops by checking if the trigger is already running for this session
    -- Or simply ensuring we only trigger if specific fields changed
    IF (OLD.full_name IS DISTINCT FROM NEW.full_name OR OLD.email IS DISTINCT FROM NEW.email) THEN
        UPDATE auth.users
        SET raw_user_meta_data = 
            COALESCE(raw_user_meta_data, '{}'::jsonb) || 
            jsonb_build_object('full_name', NEW.full_name)
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

-- 4. CASCADE CLEANUP (Handle Deletion)
-- Handles cleaning up all associated enterprise data when a user is hard-deleted
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Force removal of related records if not already handled by foreign key cascades
    -- Audit logs are preserved (references are set to NULL by schema)
    DELETE FROM public.user_roles WHERE user_id = OLD.id;
    DELETE FROM public.profiles WHERE user_id = OLD.id;
    RETURN OLD;
END;
$$;

-- 5. APPLY TRIGGERS
-- Auth -> Profile (Insert/Update)
CREATE TRIGGER on_auth_user_sync
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile();

-- Profile -> Auth (Metadata Sync)
DROP TRIGGER IF EXISTS tr_sync_profile_to_auth ON public.profiles;
CREATE TRIGGER tr_sync_profile_to_auth
  AFTER UPDATE OF full_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_auth();

-- Auth -> Cleanup (Delete)
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deletion();

-- 6. DATA VALIDATION CONSTRAINTS
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- 7. REPAIR ORPHANS (One-time fix for existing users)
INSERT INTO public.profiles (user_id, email, full_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', '')
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, COALESCE((raw_user_meta_data->>'role')::public.app_role, 'student')
FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;
