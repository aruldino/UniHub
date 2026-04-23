-- ANALYTICS & INSIGHTS SYSTEM

-- 1. VIEW: Student Performance Trends (Average grades per subject)
CREATE OR REPLACE VIEW public.view_subject_performance AS
SELECT 
    s.id as subject_id,
    s.name as subject_name,
    AVG(er.marks_obtained) as avg_marks,
    AVG(er.grade_point) as avg_grade_point,
    COUNT(er.id) as total_results
FROM public.subjects s
JOIN public.exams e ON e.subject_id = s.id
JOIN public.exam_results er ON er.exam_id = e.id
GROUP BY s.id, s.name;

-- 2. VIEW: Attendance Rate by Subject
CREATE OR REPLACE VIEW public.view_attendance_stats AS
SELECT 
    s.id as subject_id,
    s.name as subject_name,
    COUNT(*) filter (where a.status = 'present') * 100.0 / COUNT(*) as attendance_rate,
    COUNT(*) as total_records
FROM public.subjects s
JOIN public.attendance a ON a.subject_id = s.id
GROUP BY s.id, s.name;

-- 3. VIEW: Lecturer Workload (Subjects, Assignments, Students)
CREATE OR REPLACE VIEW public.view_lecturer_workload AS
SELECT 
    p.user_id as lecturer_id,
    p.full_name as lecturer_name,
    COUNT(DISTINCT s.id) as subjects_count,
    COUNT(DISTINCT a.id) as assignments_count,
    COUNT(DISTINCT e.student_id) as total_students
FROM public.profiles p
LEFT JOIN public.subjects s ON s.lecturer_id = p.user_id
LEFT JOIN public.assignments a ON a.subject_id = s.id
LEFT JOIN public.enrollments e ON e.subject_id = s.id
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'lecturer')
GROUP BY p.user_id, p.full_name;

-- 4. VIEW: Financial Collection Summary (Monthly)
CREATE OR REPLACE VIEW public.view_monthly_finance AS
SELECT 
    to_char(payment_date, 'Mon YYYY') as month,
    SUM(amount) as total_collected,
    COUNT(*) as transaction_count
FROM public.fee_payments
GROUP BY to_char(payment_date, 'Mon YYYY'), date_trunc('month', payment_date)
ORDER BY date_trunc('month', payment_date) DESC;

-- RLS for Views (Ensuring security)
ALTER VIEW public.view_subject_performance SET (security_invoker = on);
ALTER VIEW public.view_attendance_stats SET (security_invoker = on);
ALTER VIEW public.view_lecturer_workload SET (security_invoker = on);
ALTER VIEW public.view_monthly_finance SET (security_invoker = on);
