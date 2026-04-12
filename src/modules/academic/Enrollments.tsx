import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Search, Building2, UserMinus, Plus, Filter, Users } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const Enrollments = () => {
    const { user, role } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [subjects, setSubjects] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const subId = searchParams.get('subject');
        if (subId) setSelectedSubject(subId);
    }, [searchParams]);

    const [search, setSearch] = useState('');

    // Form state
    const [isAddOpen, setIsAddOpen] = useState(false);
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

    const filtered = enrollments.filter(e => {
        const matchesSubject = selectedSubject === 'all' || e.subject_id === selectedSubject;
        const matchesSearch = e.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            e.profiles?.email?.toLowerCase().includes(search.toLowerCase());
        return matchesSubject && matchesSearch;
    });

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-heading">Course Enrollments</h1>
                        <p className="text-muted-foreground">Manage student access to subjects and academic modules</p>
                    </div>

                    {role === 'admin' && (
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
                    )}
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Find student by name or email..."
                            className="pl-10"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-64">
                        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                            <SelectTrigger className="bg-card">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
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
