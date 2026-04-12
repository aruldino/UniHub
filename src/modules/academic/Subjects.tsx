import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Search, Clock, User, Building2, Loader2, Edit2, Trash2, Users, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { isAdminRole } from '@/lib/roles';

type DeptLite = { id: string; name: string; description?: string | null };

const Subjects = () => {
    const { user, role, profile } = useAuth();
    const { toast } = useToast();

    const [subjects, setSubjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Admin Data
    const [lecturers, setLecturers] = useState<any[]>([]);
    const [departments, setDepartments] = useState<DeptLite[]>([]);
    const [batches, setBatches] = useState<any[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<string>('all');

    const [deptEditOpen, setDeptEditOpen] = useState(false);
    const [deptSaving, setDeptSaving] = useState(false);
    const [deptForm, setDeptForm] = useState<{ id: string; name: string; description: string }>({
        id: '',
        name: '',
        description: ''
    });

    // Form State
    const [form, setForm] = useState({
        name: '',
        code: '',
        credits: '3',
        deptId: 'none',
        batch: 'none',
        lecturerId: 'unassigned',
        desc: ''
    });

    const [editingSubject, setEditingSubject] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [dialogOpen, setDialogOpen] = useState(false);

    const fetchData = async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // 1. Fetch Subjects based on role
            let query = supabase.from('subjects' as any).select('*').eq('is_active', true);

            if (role === 'lecturer') {
                query = (query as any).eq('lecturer_id', user.id);
            } else if (role === 'student') {
                // Fetch student enrollments first
                const { data: enrolls, error: enrollErr } = await supabase
                    .from('enrollments')
                    .select('subject_id')
                    .eq('student_id', user.id);

                if (enrollErr) throw enrollErr;

                const enrolledIds = (enrolls?.map((e) => e.subject_id).filter(Boolean) || []) as string[];
                if (enrolledIds.length === 0) {
                    setSubjects([]);
                    setDepartments([]);
                    setLoading(false);
                    return;
                }
                query = (query as any).in('id', enrolledIds);
            }

            const { data: subData, error: subError } = await (query as any);
            if (subError) throw subError;

            // 2. Fetch Helper Data (Profiles for names, departments)
            const lecIds = [...new Set(subData.filter((s: any) => s.lecturer_id).map((s: any) => s.lecturer_id))];
            const deptIds = [...new Set(subData.filter((s: any) => s.department_id).map((s: any) => s.department_id))];

            const [profRes, deptRes] = await Promise.all([
                lecIds.length ? (supabase.from('profiles').select('user_id, full_name').in('user_id', lecIds as any[]) as any) : Promise.resolve({ data: [] }),
                isAdminRole(role)
                    ? (supabase.from('departments' as any).select('id, name, description').order('name') as any)
                    : (deptIds.length ? (supabase.from('departments' as any).select('id, name, description').in('id', deptIds as any[]) as any) : Promise.resolve({ data: [] }))
            ]);

            const profMap = Object.fromEntries(profRes.data?.map(p => [p.user_id, p.full_name]) || []);
            const deptMap = Object.fromEntries((deptRes.data || []).map((d: any) => [d.id, d.name]) || []);

            const enriched = subData.map((s: any) => ({
                ...s,
                lecturer_name: profMap[s.lecturer_id] || 'Unassigned',
                dept_name: deptMap[s.department_id] || 'General'
            }));

            setSubjects(enriched);
            setDepartments((deptRes.data || []) as DeptLite[]);

            // Keep department selection sane across data refresh
            if (isAdminRole(role)) {
                const stillExists = selectedDeptId === 'all' || (deptRes.data || []).some((d: any) => d.id === selectedDeptId);
                if (!stillExists) setSelectedDeptId('all');
            } else {
                const availableDeptIds = new Set(enriched.filter((s: any) => s.department_id).map((s: any) => s.department_id));
                const canShowSelected =
                    selectedDeptId === 'all' ||
                    selectedDeptId === 'general' ||
                    availableDeptIds.has(selectedDeptId);
                if (!canShowSelected) setSelectedDeptId('all');
            }

            // 3. Admin-only: Fetch all lecturers, departments and batches for creation
            // Lecturers: query user_roles then profiles. A profiles↔user_roles PostgREST embed
            // is unreliable here (no direct FK between those tables), which left the dropdown empty.
            if (isAdminRole(role)) {
                const [lecturerRolesRes, dRes, bRes] = await Promise.all([
                    supabase.from('user_roles').select('user_id').eq('role', 'lecturer'),
                    supabase.from('departments' as any).select('id, name, description').order('name') as any,
                    supabase.from('batches' as any).select('name').order('name') as any
                ]);
                if (lecturerRolesRes.error) throw lecturerRolesRes.error;

                const lecturerIds = [...new Set((lecturerRolesRes.data ?? []).map((r) => r.user_id))];

                let lecturerProfiles: { user_id: string; full_name: string }[] = [];
                if (lecturerIds.length > 0) {
                    const { data: lp, error: lpErr } = await supabase
                        .from('profiles')
                        .select('user_id, full_name')
                        .in('user_id', lecturerIds)
                        .order('full_name', { ascending: true });
                    if (lpErr) throw lpErr;
                    lecturerProfiles = (lp ?? []) as { user_id: string; full_name: string }[];
                }
                setLecturers(lecturerProfiles);
                setDepartments(dRes.data || []);
                setBatches(bRes.data || []);
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchData();
    }, [user, role, profile]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        // Validate subject name - min 10, max 30 characters
        if (form.name.length < 10 || form.name.length > 30) {
            toast({ title: 'Invalid name', description: 'Subject name must be 10-30 characters.', variant: 'destructive' });
            setIsSaving(false);
            return;
        }

        // Validate course code - 2 letters + 4 numbers (e.g., CS1001)
        const codePattern = /^[A-Za-z]{2}\d{4}$/;
        if (!codePattern.test(form.code)) {
            toast({ title: 'Invalid code', description: 'Course code must be 2 letters + 4 numbers (e.g., CS1001).', variant: 'destructive' });
            setIsSaving(false);
            return;
        }

        try {
            // Check if subject already has a lecturer assigned
            if (form.lecturerId !== 'unassigned' && editingSubject?.lecturer_id) {
                const { data: existing } = await supabase
                    .from('subjects')
                    .select('lecturer_id, profiles(full_name)')
                    .eq('id', editingSubject.id)
                    .single();
                
                if (existing?.lecturer_id && existing.lecturer_id !== form.lecturerId) {
                    toast({ 
                        title: 'Subject Already Assigned', 
                        description: `This subject is already assigned to ${existing.profiles?.full_name || 'another lecturer'}. Please unassign first or select a different subject.`, 
                        variant: 'destructive' 
                    });
                    setIsSaving(false);
                    return;
                }
            }

            const data = {
                name: form.name,
                code: form.code,
                credits: parseInt(form.credits),
                department_id: form.deptId === 'none' ? null : form.deptId,
                batch: form.batch === 'none' ? null : form.batch,
                lecturer_id: form.lecturerId === 'unassigned' ? null : form.lecturerId,
                description: form.desc
            };

            if (editingSubject) {
                const { error } = await supabase.from('subjects').update(data).eq('id', editingSubject.id);
                if (error) throw error;
                toast({ title: 'Success', description: 'Subject updated.' });
            } else {
                const { error } = await supabase.from('subjects').insert([data]);
                if (error) throw error;
                toast({ title: 'Success', description: 'Subject created.' });
            }

            setDialogOpen(false);
            setEditingSubject(null);
            setForm({ name: '', code: '', credits: '3', deptId: 'none', batch: 'none', lecturerId: 'unassigned', desc: '' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? This will delete the subject and all related enrollments/timetable data.')) return;
        try {
            const { error } = await supabase.from('subjects').delete().eq('id', id);
            if (error) throw error;
            toast({ title: 'Subject deleted' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
        }
    };

    const openEditDialog = (subject: any) => {
        setEditingSubject(subject);
        setForm({
            name: subject.name,
            code: subject.code,
            credits: subject.credits.toString(),
            deptId: subject.department_id || 'none',
            batch: subject.batch || '',
            lecturerId: subject.lecturer_id || 'unassigned',
            desc: subject.description || ''
        });
        setDialogOpen(true);
    };

    const openNewSubjectForDept = () => {
        setEditingSubject(null);
        setForm({
            name: '',
            code: '',
            credits: '3',
            deptId: selectedDeptId === 'all' ? 'none' : selectedDeptId === 'general' ? 'none' : selectedDeptId,
            batch: '',
            lecturerId: 'unassigned',
            desc: ''
        });
        setDialogOpen(true);
    };

    const openEditDepartment = () => {
        if (selectedDeptId === 'all' || selectedDeptId === 'general') return;
        const dept = departments.find(d => d.id === selectedDeptId);
        if (!dept) return;
        setDeptForm({
            id: dept.id,
            name: dept.name || '',
            description: dept.description || ''
        });
        setDeptEditOpen(true);
    };

    const handleSaveDepartment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deptForm.id) return;
        setDeptSaving(true);
        try {
            const { error } = await (supabase.from('departments' as any).update({
                name: deptForm.name.trim(),
                description: deptForm.description.trim()
            }).eq('id', deptForm.id) as any);
            if (error) throw error;
            toast({ title: 'Success', description: 'Department updated.' });
            setDeptEditOpen(false);
            fetchData();
        } catch (error: any) {
            toast({ title: 'Failed', description: error.message, variant: 'destructive' });
        } finally {
            setDeptSaving(false);
        }
    };

    const filtered = subjects
        .filter((s: any) => {
            if (selectedDeptId === 'all') return true;
            if (selectedDeptId === 'general') return !s.department_id;
            return s.department_id === selectedDeptId;
        })
        .filter((s: any) => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()));

    const subjectCountByDeptId = subjects.reduce<Record<string, number>>((acc, s: any) => {
        const key = s.department_id || 'general';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold font-heading">Subjects</h1>
                        <p className="text-muted-foreground">
                            {isAdminRole(role) ? 'System-wide course management' : role === 'lecturer' ? 'My Assigned Courses' : 'My Academic Curriculum'}
                        </p>
                    </div>

                    {isAdminRole(role) && (
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gradient-primary" onClick={openNewSubjectForDept}>
                                    <Plus className="mr-2 h-4 w-4" /> New Subject
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <DialogHeader><DialogTitle>{editingSubject ? 'Modify Campus Course' : 'Create Campus Course'}</DialogTitle></DialogHeader>
                                <form onSubmit={handleSave} className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Subject Name <span className="text-[10px] text-muted-foreground">(10-30 chars)</span></Label>
                                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value.slice(0, 30) })} minLength={10} maxLength={30} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Course Code <span className="text-[10px] text-muted-foreground">(2 letters + 4 numbers)</span></Label>
                                            <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().slice(0, 6) })} maxLength={6} required />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Department</Label>
                                            <Select value={form.deptId} onValueChange={v => setForm({ ...form, deptId: v })}>
<SelectTrigger><SelectValue placeholder="Select a lecturer" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">N/A</SelectItem>
                                                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Target Batch</Label>
                                            <Select value={form.batch} onValueChange={v => setForm({ ...form, batch: v })}>
                                                <SelectTrigger><SelectValue placeholder="Select Batch" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    {batches.map(b => <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Assign Lecturer</Label>
                                        <Select value={form.lecturerId} onValueChange={async (v) => {
                                            if (v !== 'unassigned' && editingSubject?.lecturer_id && editingSubject.lecturer_id !== v) {
                                                const { data: existing } = await supabase
                                                    .from('subjects')
                                                    .select('lecturer_id, profiles(full_name)')
                                                    .eq('id', editingSubject.id)
                                                    .single();
                                                
                                                if (existing?.lecturer_id) {
                                                    toast({ 
                                                        title: 'Cannot Assign', 
                                                        description: `This subject is already assigned to ${existing.profiles?.full_name || 'another lecturer'}. Please unassign first.`, 
                                                        variant: 'destructive' 
                                                    });
                                                    return;
                                                }
                                            }
                                            setForm({ ...form, lecturerId: v });
                                        }}>
                                            <SelectTrigger><SelectValue placeholder="Select a lecturer" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                                {lecturers.map(l => <SelectItem key={l.user_id} value={l.user_id}>{l.full_name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" className="w-full" disabled={isSaving}>
                                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {editingSubject ? 'Update Subject' : 'Create Subject'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Departments */}
                    <Card className="lg:col-span-4 xl:col-span-3 overflow-hidden">
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-primary" />
                                        Departments
                                    </CardTitle>
                                    <CardDescription>Pick a department to manage subjects</CardDescription>
                                </div>
                                {isAdminRole(role) && selectedDeptId !== 'all' && selectedDeptId !== 'general' && (
                                    <Button variant="outline" size="sm" onClick={openEditDepartment}>
                                        <Pencil className="mr-2 h-3.5 w-3.5" />
                                        Edit
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedDeptId('all')}
                                    className={`w-full text-left flex items-center justify-between rounded-xl px-3 py-2.5 border transition-colors ${selectedDeptId === 'all'
                                        ? 'bg-primary/10 border-primary/20 text-primary'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    <span className="font-semibold">All</span>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200">
                                        {subjects.length}
                                    </Badge>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedDeptId('general')}
                                    className={`w-full text-left flex items-center justify-between rounded-xl px-3 py-2.5 border transition-colors ${selectedDeptId === 'general'
                                        ? 'bg-primary/10 border-primary/20 text-primary'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    <span className="font-semibold">General</span>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200">
                                        {subjectCountByDeptId.general || 0}
                                    </Badge>
                                </button>

                                <div className="pt-2 border-t border-slate-200">
                                    <div className="space-y-2 max-h-[52vh] overflow-auto pr-1">
                                        {departments.map((d) => {
                                            const isActive = selectedDeptId === d.id;
                                            const count = subjectCountByDeptId[d.id] || 0;
                                            return (
                                                <button
                                                    key={d.id}
                                                    type="button"
                                                    onClick={() => setSelectedDeptId(d.id)}
                                                    className={`w-full text-left flex items-center justify-between rounded-xl px-3 py-2.5 border transition-colors ${isActive
                                                        ? 'bg-primary/10 border-primary/20 text-primary'
                                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    <div className="min-w-0">
                                                        <p className={`font-semibold truncate ${isActive ? 'text-primary' : 'text-slate-900'}`}>
                                                            {d.name}
                                                        </p>
                                                        {d.description ? (
                                                            <p className="text-xs text-slate-500 truncate">{d.description}</p>
                                                        ) : null}
                                                    </div>
                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200">
                                                        {count}
                                                    </Badge>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Subjects */}
                    <div className="lg:col-span-8 xl:col-span-9 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                            <div className="flex items-center gap-4 bg-card p-3 rounded-xl border flex-1">
                                <Search className="h-4 w-4 text-muted-foreground ml-2" />
                                <Input
                                    placeholder="Search code or subject name..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="border-none shadow-none focus-visible:ring-0"
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center p-12">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <Card className="border-dashed">
                                <CardContent className="p-10 text-center">
                                    <p className="text-slate-900 font-semibold mb-1">No subjects found</p>
                                    <p className="text-sm text-muted-foreground">
                                        Try changing department or search keywords.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {filtered.map(s => (
                                    <Card key={s.id} className="group hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary overflow-hidden">
                                        <CardHeader className="pb-3">
                                            <div className="flex justify-between items-start mb-2">
                                                <Badge variant="outline" className="font-mono text-[10px]">{s.code}</Badge>
                                                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none">{s.batch || 'Generic'}</Badge>
                                            </div>
                                            <CardTitle className="text-xl font-heading group-hover:text-primary transition-colors">{s.name}</CardTitle>
                                            <CardDescription className="flex items-center gap-1.5 mt-1">
                                                <Building2 className="h-3 w-3" /> {s.dept_name}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/30 p-2.5 rounded-lg">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    <span>{s.credits} Credits</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 font-medium text-foreground">
                                                    <User className="h-3.5 w-3.5 text-primary" />
                                                    <span>{s.lecturer_name}</span>
                                                </div>
                                            </div>
                                            {isAdminRole(role) && (
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-xs h-8 flex-1 min-w-[80px]"
                                                        onClick={() => window.location.href = `/admin/enrollments?subject=${s.id}`}
                                                    >
                                                        <Users className="mr-1 h-3 w-3" /> Enroll
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="text-xs h-8 flex-1 min-w-[60px]" onClick={() => openEditDialog(s)}>
                                                        <Edit2 className="mr-1 h-3 w-3" /> Edit
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-destructive border-destructive/20 hover:bg-destructive/5 text-xs h-8"
                                                        onClick={() => handleDelete(s.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Department edit dialog (admin only) */}
            {isAdminRole(role) && (
                <Dialog open={deptEditOpen} onOpenChange={setDeptEditOpen}>
                    <DialogContent className="sm:max-w-[520px]">
                        <DialogHeader>
                            <DialogTitle>Update Department</DialogTitle>
                            <DialogDescription>Changes apply immediately across the system.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSaveDepartment} className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Department Name</Label>
                                <Input
                                    value={deptForm.name}
                                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                                    placeholder="e.g. Computer Science"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input
                                    value={deptForm.description}
                                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                                    placeholder="Optional description"
                                />
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={deptSaving}>
                                    {deptSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save changes
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </DashboardLayout>
    );
};

export default Subjects;
