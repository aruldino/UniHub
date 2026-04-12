-- ENTERPRISE AUDIT LOGGING SYSTEM

-- 1. Create Advanced Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Prevent tampering (No updates or deletes allowed on logs)
CREATE OR REPLACE FUNCTION public.block_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are tamper-proof and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_block_audit_mutation
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

-- 3. Advanced Audit Trigger Function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT;
    v_user_role TEXT;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
BEGIN
    -- Capture user context from profiles/user_roles
    SELECT email INTO v_user_email FROM public.profiles WHERE user_id = v_user_id;
    SELECT role::text INTO v_user_role FROM public.user_roles WHERE user_id = v_user_id;

    IF (TG_OP = 'UPDATE') THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
    ELSIF (TG_OP = 'DELETE') THEN
        v_old := to_jsonb(OLD);
    ELSIF (TG_OP = 'INSERT') THEN
        v_new := to_jsonb(NEW);
    END IF;

    INSERT INTO public.audit_logs (
        user_id, user_email, user_role,
        action, table_name, record_id,
        old_data, new_data,
        ip_address, user_agent
    ) VALUES (
        v_user_id, v_user_email, v_user_role,
        TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id),
        v_old, v_new,
        inet_client_addr()::text,
        NULL -- User agent is hard to get directly in SQL without custom headers
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply Triggers to Critical Tables
-- Profiles
CREATE TRIGGER audit_profiles_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Subjects
CREATE TRIGGER audit_subjects_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Exams
CREATE TRIGGER audit_exams_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.exams
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Exam Results
CREATE TRIGGER audit_results_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.exam_results
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Finance
CREATE TRIGGER audit_fees_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.student_fees
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- 5. RLS POLICIES
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only view audit logs" 
ON public.audit_logs FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Note: No INSERT policy needed for users because trigger runs as SECURITY DEFINER
