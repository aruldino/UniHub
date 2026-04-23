-- EXAM & RESULTS MANAGEMENT SYSTEM

-- 1. Create Exams Table
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    exam_type TEXT NOT NULL CHECK (exam_type IN ('Midterm', 'Final', 'Quiz', 'Lab', 'Internal')),
    exam_date TIMESTAMPTZ NOT NULL,
    max_marks INTEGER DEFAULT 100,
    is_published BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Exam Results Table
CREATE TABLE IF NOT EXISTS public.exam_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    marks_obtained DECIMAL(5,2),
    grade_point DECIMAL(3,2),
    letter_grade TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(exam_id, student_id)
);

-- 3. Automatic Grade Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_exam_grade()
RETURNS TRIGGER AS $$
DECLARE
    max_m INTEGER;
    perc DECIMAL(5,2);
BEGIN
    SELECT max_marks INTO max_m FROM public.exams WHERE id = NEW.exam_id;
    
    perc := (NEW.marks_obtained / max_m) * 100;
    
    IF perc >= 85 THEN 
        NEW.letter_grade := 'A+'; NEW.grade_point := 4.00;
    ELSIF perc >= 75 THEN 
        NEW.letter_grade := 'A'; NEW.grade_point := 3.75;
    ELSIF perc >= 65 THEN 
        NEW.letter_grade := 'B'; NEW.grade_point := 3.00;
    ELSIF perc >= 50 THEN 
        NEW.letter_grade := 'C'; NEW.grade_point := 2.00;
    ELSE 
        NEW.letter_grade := 'F'; NEW.grade_point := 0.00;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_calculate_exam_grade
BEFORE INSERT OR UPDATE OF marks_obtained ON public.exam_results
FOR EACH ROW EXECUTE FUNCTION public.calculate_exam_grade();

-- 4. Result Locking Logic
CREATE OR REPLACE FUNCTION public.check_exam_lock()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.exams WHERE id = NEW.exam_id AND is_locked = true) THEN
        RAISE EXCEPTION 'This exam result is locked and cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_exam_lock
BEFORE UPDATE OR DELETE ON public.exam_results
FOR EACH ROW EXECUTE FUNCTION public.check_exam_lock();

-- 5. RLS POLICIES
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- Exams Policies
CREATE POLICY "Anyone can view exams" ON public.exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage exams" ON public.exams FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Exam Results Policies
CREATE POLICY "Students see own published results" 
ON public.exam_results FOR SELECT 
TO authenticated 
USING (
    student_id = auth.uid() AND 
    EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND is_published = true)
);

CREATE POLICY "Lecturers manage results for their subjects" 
ON public.exam_results FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.exams e
        JOIN public.subjects s ON e.subject_id = s.id
        WHERE e.id = exam_results.exam_id AND s.lecturer_id = auth.uid()
    )
);

CREATE POLICY "Admins full results access" ON public.exam_results FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. Trigger for updated_at
CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exam_results_updated_at BEFORE UPDATE ON public.exam_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
