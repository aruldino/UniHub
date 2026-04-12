import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardCheck, Calendar as CalendarIcon, Loader2, Check, X, Clock, AlertCircle, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { isAdminRole, isStaffRole } from '@/lib/roles';

const Attendance = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Lecturer/Admin state
  const [departments, setDepartments] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('none');
  const [selectedBatch, setSelectedBatch] = useState<string>('none');
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Student state
  const [studentRecords, setStudentRecords] = useState<any[]>([]);

  const fetchSubjects = async () => {
    try {
      let query = supabase.from('subjects').select('*').eq('is_active', true);

      if (isAdminRole(role)) {
        if (selectedDept !== 'none') query = (query as any).eq('department_id', selectedDept);
        if (selectedBatch !== 'none') query = (query as any).eq('batch', selectedBatch);
      } else if (role === 'lecturer') {
        query = query.eq('lecturer_id', user?.id);
        if (selectedDept !== 'none') query = (query as any).eq('department_id', selectedDept);
        if (selectedBatch !== 'none') query = (query as any).eq('batch', selectedBatch);
      } else if (role === 'student') {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('subject_id')
          .eq('student_id', user?.id);

        const subIds = enrollments?.map(e => e.subject_id) || [];
        query = query.in('id', subIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSubjects(data || []);

      // Keep selected subject if it's still in the list, otherwise pick first
      if (data && data.length > 0) {
        if (!data.find(s => s.id === selectedSubject)) {
          setSelectedSubject(data[0].id);
        }
      } else {
        setSelectedSubject('');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      if (!isStaffRole(role)) setLoading(false);
    }
  };

  const fetchFilters = async () => {
    if (!isStaffRole(role)) return;
    try {
      const [deptRes, batchRes] = await Promise.all([
        supabase.from('departments' as any).select('*'),
        supabase.from('batches' as any).select('*')
      ]);
      setDepartments(deptRes.data || []);
      setBatches(batchRes.data || []);
    } catch (error) {
      console.error('Filter fetch error:', error);
    }
  };

  const fetchStudents = async () => {
    if (!selectedSubject || !isStaffRole(role)) return;
    setLoading(true);
    try {
      const { data: enrollData, error: enrollError } = await (supabase
        .from('enrollments')
        .select('student_id')
        .eq('subject_id', selectedSubject) as any);

      if (enrollError) throw enrollError;

      const studentIds = enrollData?.map((e: any) => e.student_id) || [];
      let studentsList: any[] = [];

      if (studentIds.length > 0) {
        const { data: profiles } = await (supabase
          .from('profiles')
          .select('user_id, full_name, email, batch')
          .in('user_id', studentIds) as any);

        studentsList = profiles?.map((p: any) => ({
          id: p.user_id,
          name: p.full_name,
          email: p.email,
          batch: p.batch
        })) || [];
      }

      const { data: existData } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('subject_id', selectedSubject)
        .eq('date', date);

      setStudents(studentsList);

      const initialAttendance: Record<string, string> = {};
      studentsList.forEach(s => {
        const existing = existData?.find(a => a.student_id === s.id);
        initialAttendance[s.id] = existing?.status || 'present';
      });
      setAttendanceData(initialAttendance);

    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentRecords = async () => {
    if (role !== 'student') return;
    setLoading(true);
    try {
      const { data: attData, error: attError } = await (supabase
        .from('attendance')
        .select('status, date, subject_id, subjects(id, name, code)')
        .eq('student_id', user?.id)
        .order('date', { ascending: false }) as any);

      if (attError) throw attError;
      setStudentRecords(attData || []);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSubjects();
      fetchFilters();
    }
  }, [user, role, selectedDept, selectedBatch]);

  useEffect(() => {
    if (selectedSubject && isStaffRole(role)) fetchStudents();
    if (role === 'student') fetchStudentRecords();
  }, [selectedSubject, date, role]);

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceData(prev => ({ ...prev, [studentId]: status }));
  };

  const handleMarkAllPresent = () => {
    const newData = { ...attendanceData };
    students.forEach(s => { newData[s.id] = 'present'; });
    setAttendanceData(newData);
    toast({ title: 'Marked all as present', description: 'Click save to finalize.' });
  };

  const handleSubmitAttendance = async () => {
    setIsSubmitting(true);
    try {
      const inserts = Object.entries(attendanceData).map(([studentId, status]) => ({
        subject_id: selectedSubject,
        student_id: studentId,
        date: date,
        status: status,
        marked_by: user?.id
      }));

      const { error } = await supabase
        .from('attendance')
        .upsert(inserts, { onConflict: 'subject_id,student_id,date' });

      if (error) throw error;
      toast({ title: 'Success', description: 'Attendance has been recorded.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Attendance</h1>
            <p className="text-muted-foreground">
              {isStaffRole(role) ? 'Record daily attendance for your classes' : 'Track your presence in classes'}
            </p>
          </div>

          {isStaffRole(role) && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-1.5 shadow-sm">
                <CalendarIcon className="h-4 w-4 text-primary" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent border-none text-sm focus:outline-none text-foreground"
                />
              </div>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="w-[180px] bg-card text-foreground border-dashed">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                <SelectTrigger className="w-[140px] bg-card text-foreground border-dashed">
                  <SelectValue placeholder="Batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All Batches</SelectItem>
                  {batches.map(b => (
                    <SelectItem key={b.id || b.name} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="w-[200px] bg-card text-foreground font-bold border-primary/20">
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-bold">{s.name}</span>
                      <span className="ml-2 text-[10px] opacity-60 uppercase">({s.code}) — {s.batch || 'Gen'}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isStaffRole(role) ? (
          <Card className="shadow-premium border-none overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-heading">Student Roster</CardTitle>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">{students.length} Enrolled</span>
                  {students.length > 0 && (
                    <Button variant="outline" size="sm" onClick={handleMarkAllPresent} className="h-8 text-xs">
                      Mark All Present
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {students.length === 0 ? (
                <div className="p-16 text-center text-muted-foreground space-y-4">
                  <div className="bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <Users className="h-8 w-8 text-primary/40" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">No Students Found</h3>
                    <p className="text-sm max-w-xs mx-auto">
                      There are no students enrolled in this subject yet. Go to the Enrollments page to add students.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin/enrollments'}>
                    Go to Enrollments
                  </Button>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Student</TableHead>
                        <TableHead>Current Status</TableHead>
                        <TableHead className="text-right pr-6">Mark Attendance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="pl-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {student.name?.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-foreground text-sm">{student.name}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-[10px] text-muted-foreground">{student.email}</p>
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 opacity-60">{student.batch || 'Gen'}</Badge>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              attendanceData[student.id] === 'present' ? 'bg-success' :
                                attendanceData[student.id] === 'absent' ? 'bg-destructive' :
                                  attendanceData[student.id] === 'late' ? 'bg-warning' : 'bg-secondary'
                            }>
                              {attendanceData[student.id]?.toUpperCase() || 'PRESENT'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant={attendanceData[student.id] === 'present' ? 'default' : 'outline'}
                                className={attendanceData[student.id] === 'present' ? 'bg-success hover:bg-success/90' : ''}
                                onClick={() => handleStatusChange(student.id, 'present')}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={attendanceData[student.id] === 'absent' ? 'default' : 'outline'}
                                className={attendanceData[student.id] === 'absent' ? 'bg-destructive hover:bg-destructive/90' : ''}
                                onClick={() => handleStatusChange(student.id, 'absent')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={attendanceData[student.id] === 'late' ? 'default' : 'outline'}
                                className={attendanceData[student.id] === 'late' ? 'bg-warning hover:bg-warning/90' : ''}
                                onClick={() => handleStatusChange(student.id, 'late')}
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-6 border-t bg-muted/10 flex justify-end">
                    <Button
                      className="gradient-primary"
                      onClick={handleSubmitAttendance}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
                      Finalize Daily Records
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {subjects.length === 0 ? (
                <Card className="col-span-full shadow-card p-12 text-center text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>You are not enrolled in any subjects yet.</p>
                </Card>
              ) : (
                subjects.map(sub => {
                  const records = studentRecords.filter(r => r.subject_id === sub.id);
                  const total = records.length;
                  const present = records.filter(r => r.status === 'present').length;
                  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

                  return (
                    <Card key={sub.id} className="shadow-premium border-none overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-heading text-foreground">{sub.name}</CardTitle>
                        <p className="text-xs text-muted-foreground uppercase">{sub.code}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-end justify-between mb-4">
                          <div>
                            <p className="text-3xl font-bold font-heading text-primary">{percentage}%</p>
                            <p className="text-xs text-muted-foreground">Attendance Rate</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">{present} / {total}</p>
                            <p className="text-xs text-muted-foreground">Days Present</p>
                          </div>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full ${percentage > 75 ? 'bg-success' : 'bg-warning'}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {studentRecords.length > 0 && (
              <Card className="shadow-premium border-none overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                  <CardTitle className="text-lg font-heading text-foreground">Recent Attendance Logs</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Date</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentRecords.map((log, i) => (
                        <TableRow key={i}>
                          <TableCell className="pl-6 font-mono text-xs text-foreground">{format(new Date(log.date), 'MMMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-foreground">{log.subjects?.name}</span>
                              <span className="text-[10px] text-muted-foreground uppercase">{log.subjects?.code}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={
                              log.status === 'present' ? 'bg-success/10 text-success border-success/20' :
                                log.status === 'absent' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                  'bg-warning/10 text-warning border-warning/20'
                            }>
                              {log.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
