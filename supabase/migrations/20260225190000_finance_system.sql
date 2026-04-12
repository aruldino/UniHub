-- FINANCE & FEE MANAGEMENT SYSTEM

-- 1. Create Fee Structures (Templates for batches/departments)
CREATE TABLE IF NOT EXISTS public.fee_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    total_amount DECIMAL(12,2) NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    batch TEXT,
    academic_year TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Student Fee Assignments (Actual balance per student)
CREATE TABLE IF NOT EXISTS public.student_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    fee_structure_id UUID REFERENCES public.fee_structures(id) ON DELETE CASCADE NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL, -- Copied from structure but can be adjusted (scholarships etc)
    paid_amount DECIMAL(12,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, fee_structure_id)
);

-- 3. Payment Transactions (Installments)
CREATE TABLE IF NOT EXISTS public.fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_fee_id UUID REFERENCES public.student_fees(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'card', 'online')),
    transaction_id TEXT,
    payment_date TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    received_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Automated Status Management Function
CREATE OR REPLACE FUNCTION public.update_fee_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.student_fees
    SET 
        paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM public.fee_payments WHERE student_fee_id = NEW.student_fee_id),
        status = CASE 
            WHEN (SELECT COALESCE(SUM(amount), 0) FROM public.fee_payments WHERE student_fee_id = NEW.student_fee_id) >= total_amount THEN 'paid'
            WHEN (SELECT COALESCE(SUM(amount), 0) FROM public.fee_payments WHERE student_fee_id = NEW.student_fee_id) > 0 THEN 'partial'
            ELSE 'unpaid'
        END,
        updated_at = now()
    WHERE id = NEW.student_fee_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_fee_status
AFTER INSERT OR UPDATE OR DELETE ON public.fee_payments
FOR EACH ROW EXECUTE FUNCTION public.update_fee_status();

-- 5. RLS POLICIES
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- Admins: Total Control
CREATE POLICY "Admins full control fee structures" ON public.fee_structures FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full control student fees" ON public.student_fees FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full control fee payments" ON public.fee_payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Students: View Only Own
CREATE POLICY "Students view own fees" 
ON public.student_fees FOR SELECT 
TO authenticated 
USING (student_id = auth.uid());

CREATE POLICY "Students view own payments" 
ON public.fee_payments FOR SELECT 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.student_fees WHERE id = student_fee_id AND student_id = auth.uid()));

CREATE POLICY "Students view relevant structures" 
ON public.fee_structures FOR SELECT 
TO authenticated 
USING (true); -- General fee info is public inside academy

-- 6. Trigger for updated_at
CREATE TRIGGER update_fee_structures_updated_at BEFORE UPDATE ON public.fee_structures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_student_fees_updated_at BEFORE UPDATE ON public.student_fees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
