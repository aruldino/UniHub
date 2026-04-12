/**
 * MVC — Service (data access). Assignments page aggregates.
 */
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types';

export type AssignmentsBootstrap = {
  subjects: any[];
  departments: any[];
  assignments: any[];
};

export async function fetchAssignmentsBootstrap(
  userId: string | undefined,
  role: AppRole | null,
): Promise<AssignmentsBootstrap> {
  let subQuery = supabase.from('subjects').select('id, name, code, department_id, batch');
  if (role === 'lecturer') subQuery = subQuery.eq('lecturer_id', userId!);
  const { data: subs } = await (subQuery as any);

  const { data: depts } = await (supabase.from('departments' as any).select('id, name') as any);

  let assignQuery = supabase.from('assignments').select('*, subjects(name, code, id, department_id)' as any);
  if (role === 'lecturer') {
    const subIds = subs?.map((s: any) => s.id) || [];
    assignQuery = (assignQuery as any).in('subject_id', subIds);
  }

  const { data: assigns } = await (assignQuery as any);
  let assignList = assigns || [];

  if (role === 'student' && userId) {
    const { data: enrolls } = await supabase.from('enrollments').select('subject_id').eq('student_id', userId);
    const allowed = new Set(enrolls?.map((e) => e.subject_id) || []);
    assignList = assignList.filter((a: any) => allowed.has(a.subject_id));
  }

  if (role === 'student' && userId) {
    const { data: mySubmissions } = await supabase
      .from('submissions')
      .select('assignment_id, id, marks, submitted_at, file_name')
      .eq('student_id', userId);

    const enriched = assignList.map((a: any) => ({
      ...a,
      mySubmission: mySubmissions?.find((s) => s.assignment_id === a.id),
    }));
    return { subjects: subs || [], departments: depts || [], assignments: enriched };
  }

  return { subjects: subs || [], departments: depts || [], assignments: assignList };
}

export async function fetchAssignmentFilterLists(): Promise<{ departments: any[]; batches: any[] }> {
  const [deptRes, batchRes] = await Promise.all([
    (supabase.from('departments' as any) as any).select('*').order('name'),
    (supabase.from('batches' as any) as any).select('*').order('name'),
  ]);
  return {
    departments: deptRes.data || [],
    batches: batchRes.data || [],
  };
}
