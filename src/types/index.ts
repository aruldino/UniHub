export type AppRole = 'admin' | 'lecturer' | 'student';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  department_id: string | null;
  batch: string | null;
  status: 'active' | 'inactive';
  deleted_at: string | null;
  is_active: boolean;
  bio?: string | null;
  phone?: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  description: string | null;
  lecturer_id: string | null;
  credits: number;
  semester: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
  due_date: string;
  max_marks: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url: string | null;
  file_name: string | null;
  submitted_at: string;
  is_late: boolean;
  marks: number | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
}

export interface Attendance {
  id: string;
  subject_id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  marked_by: string | null;
  created_at: string;
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  created_by: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalLecturers: number;
  totalSubjects: number;
  totalAssignments: number;
  attendanceRate: number;
  submissionRate: number;
}

export interface Grade {
  id: string;
  student_id: string;
  subject_id: string;
  grade_point: number;
  letter_grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'D' | 'F';
  marks_obtained: number;
  max_marks: number;
  semester: string;
  academic_year: string;
  is_published: boolean;
  remarks: string | null;
  created_at: string;
}

export interface SemesterGPA {
  student_id: string;
  semester: string;
  academic_year: string;
  sgpa: number;
  total_credits: number;
}

export interface Timetable {
  id: string;
  subject_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
  department_id: string | null;
  batch: string | null;
  created_at: string;
  subjects?: Subject;
}

export interface FeeStructure {
  id: string;
  name: string;
  description: string | null;
  total_amount: number;
  due_date: string;
  department_id: string | null;
  batch: string | null;
  academic_year: string | null;
}

export interface StudentFee {
  id: string;
  student_id: string;
  fee_structure_id: string;
  total_amount: number;
  paid_amount: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  fee_structures?: FeeStructure;
  profiles?: Profile;
}

export interface FeePayment {
  id: string;
  student_fee_id: string;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'card' | 'online';
  transaction_id: string | null;
  payment_date: string;
  notes: string | null;
}

export interface Exam {
  id: string;
  subject_id: string;
  title: string;
  exam_type: 'Midterm' | 'Final' | 'Quiz' | 'Lab' | 'Internal';
  exam_date: string;
  max_marks: number;
  is_published: boolean;
  is_locked: boolean;
  subjects?: Subject;
}


export interface ExamResult {
  id: string;
  exam_id: string;
  student_id: string;
  marks_obtained: number;
  grade_point: number;
  letter_grade: string;
  remarks: string | null;
  profiles?: Profile;
}

export interface Announcement {
  id: string;
  sender_id: string;
  title: string;
  content: string;
  target_type: 'global' | 'subject' | 'department' | 'batch';
  subject_id: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  sender_profile?: Profile;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  subject_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
  sender_profile?: Profile;
}
export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_data: any;
  new_data: any;
  ip_address: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  module: string;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role: AppRole;
  permission_id: string;
}




