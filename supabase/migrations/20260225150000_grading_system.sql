-- GRADING & GPA SYSTEM

-- 1. Create Grades Table
CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    grade_point NUMERIC(3,2) CHECK (grade_point >= 0 AND grade_point <= 4.0),
    letter_grade TEXT CHECK (letter_grade IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F')),
    marks_obtained NUMERIC(5,2),
    max_marks NUMERIC(5,2) DEFAULT 100,
    semester TEXT NOT NULL, -- e.g. 'Semester 1', 'Spring 2024'
    academic_year TEXT NOT NULL, -- e.g. '2023-2024'
    is_published BOOLEAN DEFAULT false,
    remarks TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, subject_id, semester)
);

-- 2. GPA Calculation View
CREATE OR REPLACE VIEW public.student_semester_gpa AS
SELECT 
    grades.student_id,
    grades.semester,
    grades.academic_year,
    SUM(grades.grade_point * subjects.credits) / SUM(subjects.credits) as sgpa,
    SUM(subjects.credits) as total_credits
FROM 
    public.grades
JOIN 
    public.subjects ON grades.subject_id = subjects.id
WHERE 
    grades.is_published = true
GROUP BY 
    grades.student_id, grades.semester, grades.academic_year;

-- 3. RLS POLICIES FOR GRADES
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- Lecturers can manage grades for their assigned subjects
CREATE POLICY "Lecturers can manage grades for assigned subjects" 
ON public.grades
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.subjects 
        WHERE id = subject_id AND lecturer_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
);

-- Students can view their own published grades
CREATE POLICY "Students can view own published grades" 
ON public.grades
FOR SELECT 
TO authenticated
USING (
    (student_id = auth.uid() AND is_published = true) OR 
    public.has_role(auth.uid(), 'admin')
);

-- 4. Audit Log Function for Grading
CREATE OR REPLACE FUNCTION public.log_grade_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
        auth.uid(),
        'GRADE_UPDATE',
        'grade',
        NEW.id,
        jsonb_build_object(
            'student_id', NEW.student_id,
            'subject_id', NEW.subject_id,
            'grade', NEW.letter_grade,
            'point', NEW.grade_point
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_grade_updated
    AFTER INSERT OR UPDATE ON public.grades
    FOR EACH ROW EXECUTE FUNCTION public.log_grade_change();
