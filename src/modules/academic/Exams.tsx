import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Calendar, Trophy, ClipboardList, Lock, Unlock, Eye,
    Plus, Loader2, Download, Printer, Search, Building2,
    Users, BookOpen, AlertCircle, Save, Edit2, Trash2
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { isStaffRole } from '@/lib/roles';

const Exams = () => {
    const { user, role } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [exams, setExams] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Filter state
    const [selectedExam, setSelectedExam] = useState<any>(null);
    const [results, setResults] = useState<any[]>([]);
    const [view, setView] = useState<'list' | 'grading' | 'report'>('list');
    const [editingExam, setEditingExam] = useState<any>(null);

    // Create Exam Form
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [form, setForm] = useState({
        title: '',
        type: 'Midterm',
        subject_id: '',
        date: '',
        max_marks: '100'
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Subjects
            let subQuery = supabase.from('subjects').select('id, name, code');
            if (role === 'lecturer') {
                subQuery = (subQuery as any).eq('lecturer_id', user?.id);
            } else if (role === 'student') {
                const { data: enrolls } = await supabase
                    .from('enrollments')
                    .select('subject_id')
                    .eq('student_id', user?.id);
                const ids = enrolls?.map((e) => e.subject_id) || [];
                if (ids.length === 0) {
                    setSubjects([]);
                    setExams([]);
                    setLoading(false);
                    return;
                }
                subQuery = (subQuery as any).in('id', ids);
            }
            const { data: subs } = await (subQuery as any);
            setSubjects(subs || []);

            // 2. Fetch Exams
            let examQuery = supabase.from('exams' as any).select('*, subjects(name, code)');
            if (role === 'lecturer') {
                const subIds = subs?.map((s: { id: string }) => s.id) || [];
                if (subIds.length === 0) {
                    setExams([]);
                    setLoading(false);
                    return;
                }
                examQuery = (examQuery as any).in('subject_id', subIds);
            } else if (role === 'student') {
                const subIds = subs?.map((s: { id: string }) => s.id) || [];
                examQuery = (examQuery as any).in('subject_id', subIds);
            }

            const { data: examList } = await (examQuery as any);

            // 3. For students, also fetch their result for each published exam
            if (role === 'student' && examList) {
                const { data: myResults } = await (supabase
                    .from('exam_results' as any)
                    .select('exam_id, marks_obtained, letter_grade, grade_point')
                    .eq('student_id', user?.id) as any);

                const enriched = examList.map((e: any) => ({
                    ...e,
                    myResult: myResults?.find(r => r.exam_id === e.id)
                }));
                setExams(enriched);
            } else {
                setExams(examList || []);
            }
        } catch (error: any) {
            toast({ title: 'Fetch failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchData();
    }, [user, role]);

    const handleSaveExam = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsActionLoading(true);
        try {
            const data = {
                title: form.title,
                exam_type: form.type,
                subject_id: form.subject_id,
                exam_date: form.date,
                max_marks: parseInt(form.max_marks)
            };

            if (editingExam) {
                const { error } = await supabase.from('exams' as any).update(data as any).eq('id', editingExam.id);
                if (error) throw error;
                toast({ title: 'Success', description: 'Exam updated.' });
            } else {
                const { error } = await supabase.from('exams' as any).insert([data as any] as any);
                if (error) throw error;
                toast({ title: 'Success', description: 'Exam scheduled.' });
            }

            setIsCreateOpen(false);
            setEditingExam(null);
            setForm({ title: '', type: 'Midterm', subject_id: '', date: '', max_marks: '100' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteExam = async (id: string) => {
        if (!confirm('Delete this exam? All student marks for this exam will be PERMANENTLY lost.')) return;
        try {
            const { error } = await supabase.from('exams' as any).delete().eq('id', id);
            if (error) throw error;
            toast({ title: 'Exam deleted' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
        }
    };

    const openEditExam = (exam: any) => {
        setEditingExam(exam);
        setForm({
            title: exam.title,
            type: exam.exam_type,
            subject_id: exam.subject_id,
            date: exam.exam_date.slice(0, 16), // Format for datetime-local
            max_marks: exam.max_marks.toString()
        });
        setIsCreateOpen(true);
    };

    const enterGradingMode = async (exam: any) => {
        setLoading(true);
        setSelectedExam(exam);
        setView('grading');
        try {
            // Fetch students enrolled in the subject
            const { data: enrollments } = await (supabase
                .from('enrollments')
                .select('student_id, profiles:student_id(full_name, email)')
                .eq('subject_id', exam.subject_id) as any);

            // Fetch existing results
            const { data: existResults } = await (supabase
                .from('exam_results' as any)
                .select('*')
                .eq('exam_id', exam.id) as any);

            const studentList = enrollments?.map((e: any) => {
                const existing = existResults?.find(r => r.student_id === e.student_id);
                return {
                    id: e.student_id,
                    name: e.profiles.full_name,
                    email: e.profiles.email,
                    marks: existing?.marks_obtained || 0,
                    grade: existing?.letter_grade || '-',
                    remarks: existing?.remarks || ''
                };
            }) || [];

            setResults(studentList);
        } catch (error: any) {
            toast({ title: 'Failed to load students', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveMarks = async (studentId: string, marks: number, remarks: string) => {
        if (selectedExam.is_locked) {
            return toast({ title: 'Locked', description: 'This exam is locked for editing.', variant: 'destructive' });
        }

        try {
            const { error } = await (supabase.from('exam_results' as any).upsert({
                exam_id: selectedExam.id,
                student_id: studentId,
                marks_obtained: marks,
                remarks: remarks
            } as any, { onConflict: 'exam_id,student_id' } as any) as any);

            if (error) throw error;

            // Local state update
            setResults(prev => prev.map(r => r.id === studentId ? { ...r, marks: marks, remarks: remarks } : r));
            toast({ title: 'Saved' });
        } catch (error: any) {
            toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
        }
    };

    const togglePublish = async (id: string, current: boolean) => {
        try {
            const { error } = await (supabase.from('exams' as any).update({ is_published: !current } as any).eq('id', id) as any);
            if (error) throw error;
            toast({ title: !current ? 'Results Published' : 'Results Hidden' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
        }
    };

    const handleLock = async (id: string) => {
        if (!confirm('Lock results? Further modification will be disabled.')) return;
        try {
            const { error } = await (supabase.from('exams' as any).update({ is_locked: true } as any).eq('id', id) as any);
            if (error) throw error;
            toast({ title: 'Exam Results Locked' });
            fetchData();
            if (selectedExam?.id === id) setSelectedExam({ ...selectedExam, is_locked: true });
        } catch (error: any) {
            toast({ title: 'Lock failed', description: error.message, variant: 'destructive' });
        }
    };

    const printResults = () => {
        window.print();
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-fade-in print:bg-white print:p-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                    <div>
                        {view === 'grading' ? (
                            <>
                                <Button variant="ghost" className="pl-0 mb-2" onClick={() => setView('list')}>
                                    ← Back to Exams
                                </Button>
                                <h1 className="text-2xl font-bold font-heading">{selectedExam?.title} Marks</h1>
                                <p className="text-muted-foreground">{selectedExam?.subjects?.name} ({selectedExam?.subjects?.code})</p>
                            </>
                        ) : (
                            <>
                                <h1 className="text-2xl font-bold font-heading">Exam Management</h1>
                                <p className="text-muted-foreground">Schedule sessions, record marks, and publish results</p>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {isStaffRole(role) && view === 'list' && (
                            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gradient-primary">
                                        <Plus className="mr-2 h-4 w-4" /> Schedule Exam
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[450px]">
                                    <DialogHeader>
                                        <DialogTitle>{editingExam ? 'Edit Academy Exam' : 'Schedule Academy Exam'}</DialogTitle>
                                        <DialogDescription>{editingExam ? 'Update exam details and date.' : 'Set dates and rules for the upcoming assessment.'}</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleSaveExam} className="space-y-4 py-2">
                                        <div className="space-y-2">
                                            <Label>Exam Title</Label>
                                            <Input
                                                placeholder="e.g. Autumn Semester Midterms"
                                                value={form.title}
                                                onChange={e => setForm({ ...form, title: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Type</Label>
                                                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Midterm">Midterm</SelectItem>
                                                        <SelectItem value="Final">Final</SelectItem>
                                                        <SelectItem value="Quiz">Quiz</SelectItem>
                                                        <SelectItem value="Lab">Lab</SelectItem>
                                                        <SelectItem value="Internal">Internal</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Subject</Label>
                                                <Select value={form.subject_id} onValueChange={v => setForm({ ...form, subject_id: v })} required>
                                                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                                    <SelectContent>
                                                        {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Exam Date (Start)</Label>
                                                <Input
                                                    type="datetime-local"
                                                    value={form.date}
                                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Max Marks</Label>
                                                <Input
                                                    type="number"
                                                    value={form.max_marks}
                                                    onChange={e => setForm({ ...form, max_marks: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" className="w-full gradient-primary" disabled={isActionLoading}>
                                                {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                {editingExam ? 'Update Exam' : 'Launch Exam'}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                        {view === 'grading' && (
                            <>
                                <Button variant="outline" onClick={printResults}>
                                    <Printer className="mr-2 h-4 w-4" /> Export Results
                                </Button>
                                <Button
                                    className={selectedExam.is_locked ? 'bg-muted' : 'bg-destructive'}
                                    disabled={selectedExam.is_locked}
                                    onClick={() => handleLock(selectedExam.id)}
                                >
                                    <Lock className="mr-2 h-4 w-4" /> {selectedExam.is_locked ? 'Locked' : 'Lock Results'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                ) : view === 'list' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {exams.length === 0 ? (
                            <Card className="md:col-span-3 border-dashed border-2 py-20 text-center text-muted-foreground bg-muted/5">
                                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-10" />
                                <p className="font-medium">No exams scheduled in the system.</p>
                            </Card>
                        ) : (
                            exams.map((exam) => (
                                <Card key={exam.id} className="shadow-premium border-none relative group transition-all hover:-translate-y-1">
                                    <div className={`absolute top-0 right-0 p-3`}>
                                        <Badge variant={exam.is_published ? 'default' : 'secondary'} className={exam.is_published ? 'bg-success' : ''}>
                                            {exam.is_published ? 'Published' : 'Draft'}
                                        </Badge>
                                    </div>
                                    <CardHeader>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tighter">{exam.exam_type}</Badge>
                                            <span className="text-[10px] font-black text-primary">{exam.subjects?.code}</span>
                                        </div>
                                        <CardTitle className="text-xl font-heading">{exam.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-xl border">
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Date</p>
                                                <p className="text-xs font-semibold">{format(new Date(exam.exam_date), 'MMM d, HH:mm')}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Max Marks</p>
                                                <p className="text-xs font-semibold">{exam.max_marks}</p>
                                            </div>
                                        </div>

                                        {role === 'student' && exam.is_published && exam.myResult && (
                                            <div className="flex items-center justify-between bg-primary/5 p-3 rounded-xl border border-primary/10">
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-primary">Your Result</p>
                                                    <p className="text-xl font-black">{exam.myResult.marks_obtained} / {exam.max_marks}</p>
                                                </div>
                                                <div className="text-right">
                                                    <Badge className="text-lg px-3 py-1 bg-primary">{exam.myResult.letter_grade}</Badge>
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-2 flex gap-2">
                                            {isStaffRole(role) ? (
                                                <>
                                                    <Button className="flex-1 gradient-primary" onClick={() => enterGradingMode(exam)}>
                                                        <ClipboardList className="mr-2 h-4 w-4" /> Grading
                                                    </Button>
                                                    <Button variant="outline" size="icon" onClick={() => openEditExam(exam)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="outline" size="icon" onClick={() => togglePublish(exam.id, exam.is_published)}>
                                                        <Eye className={`h-4 w-4 ${exam.is_published ? 'text-primary' : ''}`} />
                                                    </Button>
                                                    <Button variant="outline" size="icon" className="text-destructive border-destructive/20 hover:bg-destructive/5" onClick={() => handleDeleteExam(exam.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button className="w-full" variant="outline" disabled={!exam.is_published}>
                                                    {exam.is_published ? 'Download Slip' : 'Results Pending'}
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                ) : (
                    /* GRADING VIEW (TABLE) */
                    <div className="space-y-6">
                        <Card className="shadow-premium border-none overflow-hidden print:shadow-none">
                            <CardHeader className="bg-muted/30 border-b print:bg-white">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground print:hidden">
                                            <Trophy />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl font-heading">Performance Ledger</CardTitle>
                                            <CardDescription>Enter marks and see automatic grade calculation.</CardDescription>
                                        </div>
                                    </div>
                                    <div className="text-right hidden sm:block print:block">
                                        <p className="text-sm font-black text-primary uppercase">Subject Code</p>
                                        <p className="text-2xl font-black">{selectedExam?.subjects?.code}</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30 hover:bg-muted/30 print:bg-gray-100">
                                            <TableHead className="pl-6 w-[250px]">Candidate Details</TableHead>
                                            <TableHead className="text-center">Marks ({selectedExam.max_marks})</TableHead>
                                            <TableHead className="text-center w-[100px]">Grade</TableHead>
                                            <TableHead className="flex-1">Faculty Remarks</TableHead>
                                            <TableHead className="text-right pr-6 print:hidden">Save</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.map((student) => (
                                            <TableRow key={student.id} className="group hover:bg-muted/10 print:bg-white print:border-b">
                                                <TableCell className="pl-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm tracking-tight">{student.name}</span>
                                                        <span className="text-[10px] text-muted-foreground uppercase">{student.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Input
                                                        type="number"
                                                        className="w-20 mx-auto text-center font-bold print:border-none"
                                                        defaultValue={student.marks}
                                                        disabled={selectedExam.is_locked}
                                                        id={`m-${student.id}`}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className={`font-black text-sm px-3 ${student.grade === 'A+' ? 'border-success text-success' :
                                                        student.grade === 'F' ? 'border-destructive text-destructive' : 'border-primary text-primary'
                                                        }`}>
                                                        {student.grade === '-' ? 'N/A' : student.grade}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        placeholder="Add commentary..."
                                                        className="border-none bg-transparent hover:bg-muted/50 focus:bg-white print:bg-transparent"
                                                        defaultValue={student.remarks}
                                                        disabled={selectedExam.is_locked}
                                                        id={`r-${student.id}`}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right pr-6 print:hidden">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                                        disabled={selectedExam.is_locked}
                                                        onClick={() => {
                                                            const m = (document.getElementById(`m-${student.id}`) as HTMLInputElement).value;
                                                            const r = (document.getElementById(`r-${student.id}`) as HTMLInputElement).value;
                                                            handleSaveMarks(student.id, parseFloat(m), r);
                                                        }}
                                                    >
                                                        <Save className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-start gap-3 print:hidden">
                            <AlertCircle className="h-5 w-5 text-primary shrink-0" />
                            <p className="text-xs text-primary/80 font-medium">
                                <strong>Note:</strong> Grades are calculated using the enterprise academic scale:
                                85%+ (A+), 75%+ (A), 65%+ (B), 50%+ (C), 0-49% (F).
                                Results are only visible to students after you click <strong>Publish</strong> on the main dashboard.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default Exams;
