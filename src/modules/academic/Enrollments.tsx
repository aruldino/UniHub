import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, UserMinus, Plus, Filter, Users, Search, Layers } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

/** Subjects not tied to a department — pick under "General" in bulk flow. */
const BULK_GENERAL_DEPT = '__general__';

/** Matches single-enrollment subject filtering: open subjects or same department; no dept on profile sees all. */
function isProfileSubjectCompatible(
    profile: { department_id?: string | null },
    subject: { department_id?: string | null },
): boolean {
    if (!subject.department_id) return true;
    if (!profile.department_id) return true;
    return profile.department_id === subject.department_id;
}

const Enrollments = () => {
    const { user, role } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [subjects, setSubjects] = useState<any[]>([]);
    const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [selectedBatch, setSelectedBatch] = useState<string>('all');
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const subId = searchParams.get('subject');
        if (subId) setSelectedSubject(subId);
    }, [searchParams]);

    const [search, setSearch] = useState('');

    // Form state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkDeptId, setBulkDeptId] = useState('');
    const [bulkSubjectId, setBulkSubjectId] = useState('');
    const [bulkBatchFilter, setBulkBatchFilter] = useState<string>('all');
    const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
    const [enrollForm, setEnrollForm] = useState({ studentId: '', subjectId: '' });
    const [filteredSubjects, setFilteredSubjects] = useState<any[]>([]);
    const [studentDepts, setStudentDepts] = useState<Record<string, any>>({});

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Subjects
            let subQ = supabase.from('subjects' as any).select('id, name, code, department_id');
            if (role === 'lecturer') subQ = subQ.eq('lecturer_id', user?.id);
            
            const { data: subData } = await (subQ as any);
            setSubjects(subData || []);
            const mySubIds = subData?.map((s: any) => s.id) || [];

            const { data: deptData } = await (supabase.from('departments' as any).select('id, name').order('name') as any);
            setDepartments((deptData as { id: string; name: string }[]) || []);

            // 2. Fetch Students
            const { data: stuData } = await supabase.from('user_roles').select('user_id').eq('role', 'student');
            const studentIds = stuData?.map(s => s.user_id) || [];
            if (studentIds.length > 0) {
                const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email, batch, department_id').in('user_id', studentIds);
                setStudents(profs || []);
                
                // Map student to their department
                const depts: Record<string, any> = {};
                profs?.forEach((p: any) => {
                    if (p.department_id) depts[p.user_id] = p.department_id;
                });
                setStudentDepts(depts);
            }

            // 3. Fetch Enrollments
            let enrollQ = supabase.from('enrollments' as any)
                .select('*, profiles:student_id(full_name, email, batch), subjects(name, code)');
            
            if (role === 'lecturer') {
                enrollQ = enrollQ.in('subject_id', mySubIds);
            }
            
            const { data: enrollData } = await (enrollQ as any);
            setEnrollments(enrollData || []);

        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (isBulkOpen) setBulkSelectedIds([]);
    }, [bulkSubjectId, bulkBatchFilter, isBulkOpen]);

    const bulkDepartmentChoices = useMemo(() => {
        const rows: { id: string; name: string }[] = [];
        for (const d of departments) {
            if (subjects.some((s: any) => s.department_id === d.id)) {
                rows.push({ id: d.id, name: d.name });
            }
        }
        if (subjects.some((s: any) => !s.department_id)) {
            rows.push({ id: BULK_GENERAL_DEPT, name: 'General (no department)' });
        }
        return rows;
    }, [departments, subjects]);

    const bulkSubjectsForDept = useMemo(() => {
        if (!bulkDeptId) return [];
        if (bulkDeptId === BULK_GENERAL_DEPT) {
            return subjects.filter((s: any) => !s.department_id);
        }
        return subjects.filter((s: any) => s.department_id === bulkDeptId);
    }, [subjects, bulkDeptId]);

    // Filter subjects based on selected student's department
    useEffect(() => {
        if (!enrollForm.studentId) {
            setFilteredSubjects(subjects);
            return;
        }
        const studentDept = studentDepts[enrollForm.studentId];
        if (!studentDept) {
            setFilteredSubjects(subjects);
        } else {
            const filtered = subjects.filter(s => !s.department_id || s.department_id === studentDept);
            setFilteredSubjects(filtered);
        }
    }, [enrollForm.studentId, subjects, studentDepts]);

    const handleEnroll = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            const { error } = await (supabase.from('enrollments' as any).insert([{
                student_id: enrollForm.studentId,
                subject_id: enrollForm.subjectId
            }]) as any);

            if (error) throw error;
            toast({ title: 'Success', description: 'Student enrolled successfully.' });
            setIsAddOpen(false);
            setEnrollForm({ studentId: '', subjectId: '' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Enrollment Failed', description: error.message, variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnenroll = async (id: string) => {
        if (!confirm('Are you sure you want to unenroll this student? This will remove access to course materials, grades, and attendance.')) return;
        try {
            const { error } = await (supabase.from('enrollments' as any).delete().eq('id', id) as any);
            if (error) throw error;
            toast({ title: 'Unenrolled' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Failed', description: error.message, variant: 'destructive' });
        }
    };

    const enrollmentBatchOptions = useMemo(() => {
        let hasEmpty = false;
        const names = new Set<string>();
        enrollments.forEach((e: any) => {
            const b = (e.profiles?.batch ?? '').trim();
            if (!b) hasEmpty = true;
            else names.add(b);
        });
        return { sorted: Array.from(names).sort((a, b) => a.localeCompare(b)), hasEmpty };
    }, [enrollments]);

    const filtered = enrollments.filter((e) => {
        const matchesSubject = selectedSubject === 'all' || e.subject_id === selectedSubject;
        const matchesSearch =
            e.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            e.profiles?.email?.toLowerCase().includes(search.toLowerCase());
        const batchVal = (e.profiles?.batch ?? '').trim();
        let matchesBatch = true;
        if (selectedBatch === 'all') matchesBatch = true;
        else if (selectedBatch === '__none__') matchesBatch = !batchVal;
        else matchesBatch = batchVal === selectedBatch;
        return matchesSubject && matchesSearch && matchesBatch;
    });

    const bulkSubject = useMemo(() => subjects.find((s: any) => s.id === bulkSubjectId), [subjects, bulkSubjectId]);

    const enrolledInBulkSubject = useMemo(() => {
        if (!bulkSubjectId) return new Set<string>();
        return new Set(
            enrollments.filter((e: any) => e.subject_id === bulkSubjectId).map((e: any) => e.student_id as string),
        );
    }, [enrollments, bulkSubjectId]);

    const bulkEligibleStudents = useMemo(() => {
        if (!bulkSubject) return [];
        return students.filter((p: any) => isProfileSubjectCompatible(p, bulkSubject));
    }, [students, bulkSubject]);

    const bulkStudentBatchOptions = useMemo(() => {
        let hasEmpty = false;
        const names = new Set<string>();
        bulkEligibleStudents.forEach((p: any) => {
            const b = (p.batch ?? '').trim();
            if (!b) hasEmpty = true;
            else names.add(b);
        });
        return { sorted: Array.from(names).sort((a, b) => a.localeCompare(b)), hasEmpty };
    }, [bulkEligibleStudents]);

    const bulkDisplayStudents = useMemo(() => {
        return bulkEligibleStudents.filter((p: any) => {
            const batchVal = (p.batch ?? '').trim();
            if (bulkBatchFilter === 'all') return true;
            if (bulkBatchFilter === '__none__') return !batchVal;
            return batchVal === bulkBatchFilter;
        });
    }, [bulkEligibleStudents, bulkBatchFilter]);

    const bulkSelectableIds = useMemo(
        () => bulkDisplayStudents.map((p: any) => p.user_id as string).filter((id) => !enrolledInBulkSubject.has(id)),
        [bulkDisplayStudents, enrolledInBulkSubject],
    );

    const toggleBulkStudent = (userId: string, checked: boolean) => {
        setBulkSelectedIds((prev) => {
            if (checked) return prev.includes(userId) ? prev : [...prev, userId];
            return prev.filter((id) => id !== userId);
        });
    };

    const handleBulkEnroll = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bulkDeptId) {
            toast({ title: 'Select a department', description: 'Choose a department first.', variant: 'destructive' });
            return;
        }
        if (!bulkSubjectId || !bulkSubject) {
            toast({ title: 'Select a subject', description: 'Choose a course subject after the department.', variant: 'destructive' });
            return;
        }
        const toInsert = bulkSelectedIds.filter((id) => !enrolledInBulkSubject.has(id));
        if (toInsert.length === 0) {
            toast({ title: 'No students selected', description: 'Pick at least one student who is not already enrolled.', variant: 'destructive' });
            return;
        }
        setActionLoading(true);
        try {
            const rows = toInsert.map((student_id) => ({ student_id, subject_id: bulkSubjectId }));
            const { error } = await (supabase.from('enrollments' as any).insert(rows as any) as any);
            if (error) throw error;
            toast({
                title: 'Bulk enrollment complete',
                description: `${toInsert.length} student${toInsert.length === 1 ? '' : 's'} enrolled in ${bulkSubject.name}.`,
            });
            setIsBulkOpen(false);
            setBulkDeptId('');
            setBulkSubjectId('');
            setBulkBatchFilter('all');
            setBulkSelectedIds([]);
            fetchData();
        } catch (error: any) {
            toast({ title: 'Bulk enrollment failed', description: error.message, variant: 'destructive' });
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-heading">Course Enrollments</h1>
                        <p className="text-muted-foreground">Manage student access to subjects and academic modules</p>
                    </div>

                    {role === 'admin' && (
                        <div className="flex flex-wrap gap-2">
                            <Dialog open={isAddOpen} onOpenChange={v => { setIsAddOpen(v); if (!v) setEnrollForm({ studentId: '', subjectId: '' }); }}>
                                <DialogTrigger asChild>
                                    <Button className="gradient-primary"><Plus className="mr-2 h-4 w-4" /> New Enrollment</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Enroll Student</DialogTitle>
                                        <DialogDescription>Assign a student to a specific course subject.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleEnroll} className="space-y-4 py-2">
                                        <div className="space-y-2">
                                            <Label>Select Student</Label>
                                            <Select value={enrollForm.studentId} onValueChange={v => setEnrollForm({ ...enrollForm, studentId: v, subjectId: '' })}>
                                                <SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger>
                                                <SelectContent>
                                                    {students.map(s => (
                                                        <SelectItem key={s.user_id} value={s.user_id}>{s.full_name} - {s.batch}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Select Subject <span className="text-[10px] text-muted-foreground">(student's dept)</span></Label>
                                            <Select value={enrollForm.subjectId} onValueChange={v => setEnrollForm({ ...enrollForm, subjectId: v })}>
                                                <SelectTrigger><SelectValue placeholder="Choose subject" /></SelectTrigger>
                                                <SelectContent>
                                                    {filteredSubjects.map(s => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" className="w-full gradient-primary" disabled={actionLoading}>
                                                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Complete Enrollment
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>

                            <Dialog
                                open={isBulkOpen}
                                onOpenChange={(v) => {
                                    setIsBulkOpen(v);
                                    if (v) {
                                        const subId = selectedSubject !== 'all' ? selectedSubject : '';
                                        const sub = subjects.find((s: any) => s.id === subId);
                                        if (sub) {
                                            setBulkDeptId(sub.department_id ? sub.department_id : BULK_GENERAL_DEPT);
                                            setBulkSubjectId(sub.id);
                                        } else {
                                            setBulkDeptId('');
                                            setBulkSubjectId('');
                                        }
                                        setBulkBatchFilter(selectedBatch !== 'all' ? selectedBatch : 'all');
                                        setBulkSelectedIds([]);
                                    } else {
                                        setBulkDeptId('');
                                        setBulkSubjectId('');
                                        setBulkBatchFilter('all');
                                        setBulkSelectedIds([]);
                                    }
                                }}
                            >
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="border-primary/30">
                                        <UserPlus className="mr-2 h-4 w-4" /> Bulk enrollment
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>Bulk enrollment</DialogTitle>
                                        <DialogDescription>
                                            Pick a department, subject, and optional batch, then select students. Eligibility matches single enrollment rules.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleBulkEnroll} className="space-y-4 py-1">
                                        <div className="space-y-2">
                                            <Label>Department</Label>
                                            <Select
                                                value={bulkDeptId || undefined}
                                                onValueChange={(v) => {
                                                    setBulkDeptId(v);
                                                    setBulkSubjectId('');
                                                    setBulkBatchFilter('all');
                                                    setBulkSelectedIds([]);
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select department" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {bulkDepartmentChoices.map((d) => (
                                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Subject</Label>
                                            <Select
                                                value={bulkSubjectId || undefined}
                                                onValueChange={(v) => {
                                                    setBulkSubjectId(v);
                                                    setBulkBatchFilter('all');
                                                    setBulkSelectedIds([]);
                                                }}
                                                disabled={!bulkDeptId || bulkSubjectsForDept.length === 0}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={bulkDeptId ? 'Select subject' : 'Choose department first'} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {bulkSubjectsForDept.map((s: any) => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {bulkDeptId && bulkSubjectsForDept.length === 0 && (
                                                <p className="text-xs text-muted-foreground">No subjects are linked to this department.</p>
                                            )}
                                        </div>

                                        {bulkDeptId && bulkSubjectId && bulkSubject && (
                                            <>
                                                <div className="space-y-2">
                                                    <Label>
                                                        Batch filter{' '}
                                                        <span className="text-[10px] font-normal text-muted-foreground">(optional)</span>
                                                    </Label>
                                                    <Select value={bulkBatchFilter} onValueChange={setBulkBatchFilter}>
                                                        <SelectTrigger>
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                                <SelectValue placeholder="All batches" />
                                                            </div>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">All batches</SelectItem>
                                                            {bulkStudentBatchOptions.hasEmpty && (
                                                                <SelectItem value="__none__">No batch</SelectItem>
                                                            )}
                                                            {bulkStudentBatchOptions.sorted.map((b) => (
                                                                <SelectItem key={b} value={b}>
                                                                    {b}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                                    <span>
                                                        {bulkDisplayStudents.length} listed
                                                        <span className="ml-1">
                                                            · {bulkEligibleStudents.length} eligible for subject
                                                        </span>
                                                        {enrolledInBulkSubject.size > 0 && (
                                                            <span className="ml-1">· {enrolledInBulkSubject.size} already enrolled</span>
                                                        )}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => setBulkSelectedIds([...bulkSelectableIds])}
                                                            disabled={bulkSelectableIds.length === 0}
                                                        >
                                                            Select all
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => setBulkSelectedIds([])}
                                                            disabled={bulkSelectedIds.length === 0}
                                                        >
                                                            Clear
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div
                                                    className="max-h-[min(320px,50vh)] overflow-y-auto overscroll-contain rounded-md border p-3 pr-2 touch-pan-y [-webkit-overflow-scrolling:touch]"
                                                    role="list"
                                                >
                                                    <div className="space-y-3">
                                                        {bulkDisplayStudents.map((p: any) => {
                                                            const enrolled = enrolledInBulkSubject.has(p.user_id);
                                                            const checked = enrolled || bulkSelectedIds.includes(p.user_id);
                                                            return (
                                                                <div key={p.user_id} className="flex items-start gap-3">
                                                                    <Checkbox
                                                                        id={`bulk-${p.user_id}`}
                                                                        checked={checked}
                                                                        disabled={enrolled}
                                                                        onCheckedChange={(c) => toggleBulkStudent(p.user_id, c === true)}
                                                                    />
                                                                    <label htmlFor={`bulk-${p.user_id}`} className="grid flex-1 cursor-pointer gap-0.5 text-sm leading-tight">
                                                                        <span className="font-medium">{p.full_name}</span>
                                                                        <span className="text-[11px] text-muted-foreground">
                                                                            {p.email}
                                                                            {p.batch ? ` · ${p.batch}` : ''}
                                                                            {enrolled && (
                                                                                <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
                                                                                    Enrolled
                                                                                </Badge>
                                                                            )}
                                                                        </span>
                                                                    </label>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                {bulkEligibleStudents.length === 0 && (
                                                    <p className="text-center text-sm text-muted-foreground">No students match this subject&apos;s department rules.</p>
                                                )}
                                                {bulkEligibleStudents.length > 0 && bulkDisplayStudents.length === 0 && (
                                                    <p className="text-center text-sm text-muted-foreground">No students in this batch — choose another batch or &quot;All batches&quot;.</p>
                                                )}
                                            </>
                                        )}

                                        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                                            <span className="text-xs text-muted-foreground">
                                                {bulkSelectedIds.length > 0
                                                    ? `${bulkSelectedIds.length} selected`
                                                    : 'Select students to enroll'}
                                            </span>
                                            <Button type="submit" className="gradient-primary w-full sm:w-auto" disabled={actionLoading || bulkSelectedIds.length === 0}>
                                                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Enroll selected
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </div>

                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Find student by name or email..."
                            className="pl-10"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="w-full lg:w-56">
                        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                            <SelectTrigger className="bg-card">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <SelectValue placeholder="Filter by batch" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All batches</SelectItem>
                                {enrollmentBatchOptions.hasEmpty && (
                                    <SelectItem value="__none__">No batch</SelectItem>
                                )}
                                {enrollmentBatchOptions.sorted.map((b) => (
                                    <SelectItem key={b} value={b}>
                                        {b}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full lg:w-64">
                        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                            <SelectTrigger className="bg-card">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <SelectValue placeholder="Filter by Subject" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Subjects</SelectItem>
                                {subjects.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Card className="shadow-premium border-none overflow-hidden">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-20 text-center">
                                <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                                <h3 className="text-xl font-bold">No Records Found</h3>
                                <p className="text-muted-foreground tracking-tight">Try adjusting your filters or add a new enrollment.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead className="pl-6">Student</TableHead>
                                        <TableHead>Batch</TableHead>
                                        <TableHead>Enrolled Subject</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right pr-6">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map(e => (
                                        <TableRow key={e.id}>
                                            <TableCell className="pl-6">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm tracking-tight">{e.profiles?.full_name}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase">{e.profiles?.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-bold text-[10px]">{e.profiles?.batch || 'N/A'}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-xs">{e.subjects?.name}</span>
                                                    <span className="text-[10px] font-mono text-primary">{e.subjects?.code}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {new Date(e.enrolled_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                {role === 'admin' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleUnenroll(e.id)}
                                                    >
                                                        <UserMinus className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default Enrollments;
