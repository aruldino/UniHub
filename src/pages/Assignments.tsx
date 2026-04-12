import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Plus, FileText, Upload, Download, Clock, CheckCircle2,
  AlertCircle, ExternalLink, Loader2, Save, Send, Trash2,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { isStaffRole } from '@/lib/roles';
import { fetchAssignmentsBootstrap, fetchAssignmentFilterLists } from '@/mvc/services/assignmentsService';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const Assignments = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  // UI State
  const [view, setView] = useState<'list' | 'submissions'>('list');
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [lecturerDepts, setLecturerDepts] = useState<any[]>([]);

  // Create Assignment Form
  const [creationForm, setCreationForm] = useState({
    title: '',
    description: '',
    department_id: '',
    subject_id: '',
    due_date: '',
    max_marks: '100',
    dept_id: '',
    batch_name: ''
  });
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const boot = await fetchAssignmentsBootstrap(user?.id, role);
      setSubjects(boot.subjects);
      setDepartments(boot.departments);
      setAssignments(boot.assignments);
      
      // Extract unique departments from lecturer's assigned subjects
      if (role === 'lecturer') {
        const uniqueDepts = boot.subjects.reduce((acc: any[], s: any) => {
          if (s.department_id && !acc.find((d: any) => d.id === s.department_id)) {
            const dept = boot.departments.find((d: any) => d.id === s.department_id);
            if (dept) acc.push(dept);
          }
          return acc;
        }, []);
        setLecturerDepts(uniqueDepts);
      }
    } catch (error: any) {
      toast({ title: 'Fetch failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const { departments, batches } = await fetchAssignmentFilterLists();
      setDepartments(departments);
      setBatches(batches);
    } catch (err) {
      console.error('Error fetching filters:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      fetchFilters();
    }
  }, [user, role]);

  const filteredSubjects = subjects.filter(s => {
    const deptMatch = !creationForm.dept_id || s.department_id === creationForm.dept_id;
    const batchMatch = !creationForm.batch_name || s.batch === creationForm.batch_name;
    return deptMatch && batchMatch;
  });

  const handlePostAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    
    // Validate title
    if (creationForm.title.length > 15) {
      toast({ title: 'Invalid title', description: 'Title must be 15 characters or less.', variant: 'destructive' });
      setIsActionLoading(false);
      return;
    }
    
    // Validate due date
    if (!creationForm.due_date) {
      toast({ title: 'Invalid due date', description: 'Please select a due date.', variant: 'destructive' });
      setIsActionLoading(false);
      return;
    }
    
    const dueDate = new Date(creationForm.due_date);
    if (dueDate <= new Date()) {
      toast({ title: 'Invalid due date', description: 'Due date must be in the future.', variant: 'destructive' });
      setIsActionLoading(false);
      return;
    }
    
    // Validate max marks
    const marks = parseInt(creationForm.max_marks);
    if (isNaN(marks) || marks < 0 || marks > 100) {
      toast({ title: 'Invalid marks', description: 'Marks must be between 0 and 100.', variant: 'destructive' });
      setIsActionLoading(false);
      return;
    }
    
    try {
      const data = {
        title: creationForm.title,
        description: creationForm.description,
        subject_id: creationForm.subject_id,
        due_date: creationForm.due_date,
        max_marks: parseInt(creationForm.max_marks),
        created_by: user?.id
      };

      if (editingAssignment) {
        const { error } = await supabase
          .from('assignments')
          .update(data)
          .eq('id', editingAssignment.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Assignment updated successfully.' });
      } else {
        const { error } = await supabase.from('assignments').insert([data]);
        if (error) throw error;
        toast({ title: 'Success', description: 'Assignment posted successfully.' });
      }

      setIsCreateDialogOpen(false);
      setEditingAssignment(null);
      setCreationForm({ title: '', description: '', department_id: '', subject_id: '', due_date: '', max_marks: '100', dept_id: role === 'lecturer' && lecturerDepts.length > 0 ? lecturerDepts[0].id : '', batch_name: '' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment? All submissions will also be deleted.')) return;
    setIsActionLoading(true);
    try {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Assignment removed.' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const openEditDialog = (assignment: any) => {
    setEditingAssignment(assignment);
    setCreationForm({
      title: assignment.title,
      description: assignment.description,
      department_id: assignment.subjects?.department_id || '',
      subject_id: assignment.subject_id,
      due_date: assignment.due_date.substring(0, 16), // Format for datetime-local
      max_marks: assignment.max_marks.toString(),
      dept_id: assignment.subjects?.department_id || '',
      batch_name: assignment.subjects?.batch || ''
    });
    setIsCreateDialogOpen(true);
  };

  const handleFileUpload = async (assignmentId: string, subjectId: string, file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      return toast({ title: 'File too large', description: 'Maximum allowed size is 10MB.', variant: 'destructive' });
    }

    setIsActionLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${subjectId}/${user?.id}/${fileName}`;

      // 1. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('assignments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Fetch existing submission for versioning
      const { data: existing } = await (supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user?.id)
        .single() as any);

      // 3. Upsert into Submissions table
      const submissionData = {
        assignment_id: assignmentId,
        student_id: user?.id,
        file_url: filePath,
        file_name: file.name,
        submitted_at: new Date().toISOString(),
        version: ((existing as any)?.version || 0) + 1,
        previous_file_urls: existing ? [...((existing as any).previous_file_urls || []), (existing as any).file_url] : []
      };

      const { error: dbError } = await (supabase.from('submissions').upsert(submissionData, {
        onConflict: 'assignment_id,student_id'
      }) as any);

      if (dbError) throw dbError;

      toast({ title: 'Submitted!', description: 'Your file has been uploaded successfully.' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const viewSubmissions = async (assignment: any) => {
    setSelectedAssignment(assignment);
    setLoading(true);
    setView('submissions');
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*, profiles:student_id(full_name, email)')
        .eq('assignment_id', assignment.id);

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error: any) {
      toast({ title: 'Failed to load submissions', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('assignments')
        .createSignedUrl(filePath, 60); // 60 seconds link

      if (error) throw error;

      // Open in new tab or trigger download
      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      toast({ title: 'Download failed', description: 'Could not generate secure link.', variant: 'destructive' });
    }
  };

  const handleGradeSubmission = async (submissionId: string, marks: number, feedback: string) => {
    setIsActionLoading(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          marks,
          feedback,
          graded_by: user?.id,
          graded_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (error) throw error;
      toast({ title: 'Graded', description: 'Submission marked successfully.' });
      viewSubmissions(selectedAssignment);
    } catch (error: any) {
      toast({ title: 'Grading failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {view === 'submissions' ? (
              <>
                <Button variant="ghost" className="pl-0 mb-2" onClick={() => setView('list')}>
                  ← Back to Assignments
                </Button>
                <h1 className="text-2xl font-bold font-heading">{selectedAssignment?.title} - Submissions</h1>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold font-heading">Assignments</h1>
                <p className="text-muted-foreground">Manage files and academic assessments</p>
              </>
            )}
          </div>

          {isStaffRole(role) && view === 'list' && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary">
                  <Plus className="mr-2 h-4 w-4" /> New Assignment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingAssignment ? 'Edit Assignment' : 'Post Assignment'}</DialogTitle>
                  <DialogDescription>
                    {editingAssignment ? 'Modify the details of this assignment.' : 'Create a new task for your students to submit files for.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handlePostAssignment} className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Title <span className="text-[10px] text-muted-foreground">(max 15 chars)</span></Label>
                    <Input
                      placeholder="e.g. Final Project"
                      value={creationForm.title}
                      onChange={e => setCreationForm({ ...creationForm, title: e.target.value.slice(0, 15) })}
                      maxLength={15}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select
                        value={creationForm.dept_id}
                        onValueChange={v => setCreationForm({ ...creationForm, dept_id: v, subject_id: '' })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                        <SelectContent>
                          {(role === 'lecturer' ? lecturerDepts : departments).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Batch</Label>
                      <Select
                        value={creationForm.batch_name}
                        onValueChange={v => setCreationForm({ ...creationForm, batch_name: v, subject_id: '' })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select Batch" /></SelectTrigger>
                        <SelectContent>
                          {batches.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select
                      value={creationForm.subject_id}
                      onValueChange={v => setCreationForm({ ...creationForm, subject_id: v })}
                      required
                    >
                      <SelectTrigger><SelectValue placeholder={creationForm.department_id ? "Select Course" : "Choose Dept First"} /></SelectTrigger>
<SelectContent>
                          {subjects
                            .filter(s => (!creationForm.dept_id || s.department_id === creationForm.dept_id) &&
                              (!creationForm.batch_name || s.batch === creationForm.batch_name))
                            .map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code}) - {s.batch}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Due Date (future only)</Label>
                      <Input
                        type="datetime-local"
                        min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                        value={creationForm.due_date}
                        onChange={e => setCreationForm({ ...creationForm, due_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Marks (0-100)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={creationForm.max_marks}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 100)) {
                            setCreationForm({ ...creationForm, max_marks: val });
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Instructions</Label>
                    <Textarea
                      placeholder="Describe the assignment requirements..."
                      value={creationForm.description}
                      onChange={e => setCreationForm({ ...creationForm, description: e.target.value })}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full gradient-primary" disabled={isActionLoading}>
                      {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingAssignment ? 'Update Assignment' : 'Post Assignment'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : view === 'list' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {assignments.length === 0 ? (
              <Card className="lg:col-span-2 border-dashed border-2 py-12 text-center text-muted-foreground bg-muted/5">
                <FileText className="h-10 w-10 mx-auto mb-4 opacity-20" />
                <p>No assignments found.</p>
              </Card>
            ) : (
              assignments.map((assignment) => {
                const isPastDue = new Date(assignment.due_date) < new Date();
                return (
                  <Card key={assignment.id} className="shadow-premium border-none relative overflow-hidden group">
                    <div className={`absolute top-0 left-0 w-1 h-full ${isPastDue ? 'bg-destructive' : 'gradient-primary'}`}></div>
                    <CardHeader>
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold">{assignment.subjects?.code}</Badge>
                        <Badge className={isPastDue ? 'bg-destructive/10 text-destructive border-none' : 'bg-success/10 text-success border-none'}>
                          <Clock className="mr-1 h-3 w-3" />
                          {format(new Date(assignment.due_date), 'MMM d, HH:mm')}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl font-heading">{assignment.title}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">{assignment.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mt-2 pt-4 border-t border-muted/50">
                        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" />
                          Max Marks: <span className="text-foreground">{assignment.max_marks}</span>
                        </div>

                        {isStaffRole(role) ? (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => viewSubmissions(assignment)}>
                              Submissions
                            </Button>
                            <Button size="sm" variant="ghost" className="text-primary" onClick={() => openEditDialog(assignment)}>
                              Edit
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteAssignment(assignment.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {assignment.mySubmission ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="default" className="bg-success text-[10px]">
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> Submitted
                                </Badge>
                                {assignment.mySubmission.marks !== null && (
                                  <Badge variant="outline" className="border-primary text-primary text-[10px]">
                                    Grade: {assignment.mySubmission.marks}/{assignment.max_marks}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground border-muted text-[10px]">
                                Pending
                              </Badge>
                            )}

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" className="gradient-primary">
                                  {assignment.mySubmission ? 'Resubmit' : 'Turn In'}
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Submit: {assignment.title}</DialogTitle>
                                  <DialogDescription>
                                    Upload your file (max 10MB). Overwrites previous submission if any.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="py-6 flex flex-col items-center border-2 border-dashed rounded-xl border-muted bg-muted/5">
                                  <input
                                    type="file"
                                    id={`file-${assignment.id}`}
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(assignment.id, assignment.subject_id, file);
                                    }}
                                  />
                                  <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                                  <Button
                                    variant="outline"
                                    onClick={() => document.getElementById(`file-${assignment.id}`)?.click()}
                                    disabled={isActionLoading}
                                  >
                                    {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Choose File'}
                                  </Button>
                                  <p className="text-[10px] text-muted-foreground mt-4 italic">Accepts PDF, DOCX, ZIP</p>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        ) : (
          /* SUBMISSIONS VIEW (LECTURER) */
          <Card className="shadow-premium border-none">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Received Submissions</CardTitle>
                  <CardDescription>Click a student to view their file and provide a grade.</CardDescription>
                </div>
                <div className="text-sm font-black text-primary">
                  {submissions.filter(s => s.marks !== null).length} / {submissions.length} GRADED
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="pl-6">Student Name</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead className="text-center">Marks</TableHead>
                    <TableHead className="text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No submissions received for this assignment yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    submissions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="pl-6 font-medium">
                          <div className="flex flex-col">
                            <span>{sub.profiles?.full_name}</span>
                            <span className="text-[10px] text-muted-foreground font-normal tracking-wide">{sub.profiles?.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary p-0 h-auto"
                            onClick={() => downloadFile(sub.file_url, sub.file_name)}
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            <span className="max-w-[150px] truncate">{sub.file_name}</span>
                          </Button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(sub.submitted_at), 'MMM d, HH:mm')}
                          {new Date(sub.submitted_at) > new Date(selectedAssignment.due_date) && (
                            <Badge variant="destructive" className="ml-2 py-0 h-4 text-[9px]">LATE</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {sub.marks !== null ? (
                            <Badge className="bg-success">{sub.marks} / {selectedAssignment.max_marks}</Badge>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Unmarked</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="hover:bg-primary/10 text-primary">
                                Grade Submission
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Grade: {sub.profiles?.full_name}</DialogTitle>
                                <DialogDescription>Entering a grade will notify the student.</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Marks Obtained (0-100)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    defaultValue={sub.marks || 0}
                                    id={`marks-${sub.id}`}
                                    onInput={(e) => {
                                      const val = parseInt((e.target as HTMLInputElement).value);
                                      if (isNaN(val)) return;
                                      if (val < 0) (e.target as HTMLInputElement).value = '0';
                                      if (val > 100) (e.target as HTMLInputElement).value = '100';
                                    }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Feedback / Comments</Label>
                                  <Textarea
                                    placeholder="Great work, but focus on the..."
                                    defaultValue={sub.feedback || ''}
                                    id={`feedback-${sub.id}`}
                                  />
                                </div>
                                <Button
                                  className="w-full gradient-primary"
                                  onClick={() => {
                                    const m = (document.getElementById(`marks-${sub.id}`) as HTMLInputElement).value;
                                    const f = (document.getElementById(`feedback-${sub.id}`) as HTMLTextAreaElement).value;

                                    if (m === '') {
                                      toast({ title: 'Invalid marks', description: 'Please enter a mark value.', variant: 'destructive' });
                                      return;
                                    }

                                    const parsedMarks = parseInt(m);
                                    if (isNaN(parsedMarks) || parsedMarks < 0 || parsedMarks > 100) {
                                      toast({ title: 'Invalid marks', description: 'Marks must be between 0 and 100.', variant: 'destructive' });
                                      return;
                                    }

                                    handleGradeSubmission(sub.id, parsedMarks, f);
                                  }}
                                >
                                  Submit Grade & Notify
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout >
  );
};

export default Assignments;
