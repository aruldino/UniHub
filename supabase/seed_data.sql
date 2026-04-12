-- DUMMY SEED DATA (Academic & Administrative)
-- Run this in your Supabase SQL Editor to populate the database with sample data.

-- 1. CLEANUP (Optional - Uncomment if you want to clear existing data first)
-- TRUNCATE TABLE public.timetable, public.subjects, public.batches, public.departments CASCADE;

-- 2. DEPARTMENTS
INSERT INTO public.departments (id, name, description)
VALUES 
    (gen_random_uuid(), 'School of Computing', 'Focuses on Software Engineering, Data Science, and AI.'),
    (gen_random_uuid(), 'School of Business', 'Covers Management, Finance, and Marketing.'),
    (gen_random_uuid(), 'Department of Engineering', 'Electrical, Civil, and Mechanical Engineering tracks.')
ON CONFLICT (name) DO NOTHING;

-- 3. BATCHES
INSERT INTO public.batches (id, name, academic_year, description)
VALUES 
    (gen_random_uuid(), 'Batch 2023', '2023/24', 'Third year students'),
    (gen_random_uuid(), 'Batch 2024', '2024/25', 'Second year students'),
    (gen_random_uuid(), 'Batch 2025', '2025/26', 'Freshman intake')
ON CONFLICT DO NOTHING;

-- 4. SUBJECTS (Academic Catalog)
-- We use CTEs to fetch the IDs we just created
WITH dept AS (SELECT id, name FROM public.departments)
INSERT INTO public.subjects (id, name, code, credits, semester, department_id, batch, is_active)
VALUES 
    (gen_random_uuid(), 'Advanced Web Development', 'CS301', 4, 'Semester 5', (SELECT id FROM dept WHERE name = 'School of Computing'), 'Batch 2023', true),
    (gen_random_uuid(), 'Database Management Systems', 'CS202', 3, 'Semester 3', (SELECT id FROM dept WHERE name = 'School of Computing'), 'Batch 2024', true),
    (gen_random_uuid(), 'Financial Accounting', 'BUS101', 3, 'Semester 1', (SELECT id FROM dept WHERE name = 'School of Business'), 'Batch 2025', true),
    (gen_random_uuid(), 'Principles of Management', 'BUS201', 3, 'Semester 3', (SELECT id FROM dept WHERE name = 'School of Business'), 'Batch 2024', true),
    (gen_random_uuid(), 'Structural Engineering', 'ENG305', 4, 'Semester 6', (SELECT id FROM dept WHERE name = 'Department of Engineering'), 'Batch 2023', true)
ON CONFLICT (code) DO NOTHING;

-- 5. TIMETABLE (Schedule)
WITH sub AS (SELECT id, name, department_id, batch FROM public.subjects)
INSERT INTO public.timetable (id, subject_id, day_of_week, start_time, end_time, room, department_id, batch)
VALUES 
    -- Monday
    (gen_random_uuid(), (SELECT id FROM sub WHERE name = 'Advanced Web Development'), 0, '08:30', '10:30', 'Lab 01', (SELECT department_id FROM sub WHERE name = 'Advanced Web Development'), 'Batch 2023'),
    (gen_random_uuid(), (SELECT id FROM sub WHERE name = 'Financial Accounting'), 0, '11:00', '13:00', 'Hall A', (SELECT department_id FROM sub WHERE name = 'Financial Accounting'), 'Batch 2025'),
    
    -- Tuesday
    (gen_random_uuid(), (SELECT id FROM sub WHERE name = 'Database Management Systems'), 1, '09:00', '11:00', 'Lab 04', (SELECT department_id FROM sub WHERE name = 'Database Management Systems'), 'Batch 2024'),
    (gen_random_uuid(), (SELECT id FROM sub WHERE name = 'Principles of Management'), 1, '14:00', '16:00', 'Seminar Room 2', (SELECT department_id FROM sub WHERE name = 'Principles of Management'), 'Batch 2024')
ON CONFLICT DO NOTHING;

-- 6. GROUPS (Study Circles)
-- Note: Requires a valid user_id to be 'created_by'. If you have no users, this may fail.
-- INSERT INTO public.groups (id, name, description, created_by)
-- VALUES (gen_random_uuid(), 'Final Year Project Hub', 'Discussion for 2023 Software Projects', (SELECT user_id FROM public.profiles LIMIT 1));

-- 7. ANNOUNCEMENTS
-- Note: Requires a valid sender_id. These are commented out so you can manually provide a User ID.
/*
INSERT INTO public.announcements (id, sender_id, title, content, target_type, priority)
VALUES 
    (gen_random_uuid(), (SELECT user_id FROM public.profiles LIMIT 1), 'Campus Sports Day', 'Join us this Friday for the annual sports meet!', 'global', 'normal'),
    (gen_random_uuid(), (SELECT user_id FROM public.profiles LIMIT 1), 'Exam Schedule Released', 'Check the exams module for the Semester 1 finals schedule.', 'global', 'high');
*/

-- 8. SUMMARY DISPLAY
SELECT 'Departments' as table, count(*) from public.departments
UNION ALL SELECT 'Batches', count(*) from public.batches
UNION ALL SELECT 'Subjects', count(*) from public.subjects
UNION ALL SELECT 'Timetable', count(*) from public.timetable;
