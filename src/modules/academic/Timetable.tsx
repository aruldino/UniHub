import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Clock, MapPin, Loader2, Calendar as CalendarIcon, Filter, Trash2, Pencil } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

const Timetable = () => {
    const { user, role, profile } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [timetable, setTimetable] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [filteredSubjects, setFilteredSubjects] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [batches, setBatches] = useState<any[]>([]);

    // Filtering
    const [selectedDept, setSelectedDept] = useState<string>(profile?.department_id || 'none');
    const [selectedBatch, setSelectedBatch] = useState<string>(profile?.batch || '');

    // Add/Edit Slot Form
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState({
        subject_id: '',
        day_of_week: '0',
        start_time: '08:00',
        end_time: '09:00',
        room: '',
        department_id: 'none',
        batch: ''
    });

    const resetForm = () => {
        setForm({
            subject_id: '',
            day_of_week: '0',
            start_time: '08:00',
            end_time: '09:00',
            room: '',
            department_id: 'none',
            batch: ''
        });
        setSelectedSlot(null);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Timetable
            let query = supabase.from('timetable').select('*, subjects(name, code)');

            if (role === 'student') {
                if (profile?.department_id) query = (query as any).eq('department_id', profile.department_id);
                if (profile?.batch) query = (query as any).eq('batch', profile.batch);
            } else if (role === 'lecturer') {
                // Lecturers see all timetable slots, but we could filter to just theirs if needed.
                // For now, let's let them see the whole grid but only edit theirs.
            } else if (role === 'admin' && selectedDept !== 'none') {
                query = (query as any).eq('department_id', selectedDept);
                if (selectedBatch) query = (query as any).eq('batch', selectedBatch);
            }

            const { data: ttData } = await (query as any);
            setTimetable(ttData || []);

            // 2. Fetch Subjects & Depts for Admin/Lecturer
            if (role === 'admin' || role === 'lecturer') {
                let subQ = supabase.from('subjects').select('id, name, code, department_id');
                if (role === 'lecturer') subQ = subQ.eq('lecturer_id', user?.id);

                const [subRes, deptRes, batchRes] = await Promise.all([
                    subQ,
                    (supabase.from('departments' as any).select('*') as any),
                    (supabase.from('batches' as any).select('name') as any)
                ]);
                setSubjects(subRes.data || []);
                setFilteredSubjects(subRes.data || []);
                setDepartments(deptRes.data || []);
                setBatches(batchRes.data || []);
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedDept, selectedBatch, profile]);

    // Filter subjects when department changes in form
    useEffect(() => {
        if (!form.department_id || form.department_id === 'none') {
            setFilteredSubjects(subjects);
        } else {
            const filtered = subjects.filter(s => s.department_id === form.department_id);
            setFilteredSubjects(filtered);
        }
    }, [form.department_id, subjects]);

    const handleSaveSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const currentDeptId = form.department_id === 'none' ? null : form.department_id;

        const payload = {
            subject_id: form.subject_id,
            day_of_week: parseInt(form.day_of_week),
            start_time: form.start_time,
            end_time: form.end_time,
            room: form.room,
            department_id: currentDeptId,
            batch: form.batch || null
        };

        try {
            if (selectedSlot) {
                const { error } = await supabase
                    .from('timetable')
                    .update(payload)
                    .eq('id', selectedSlot.id);
                if (error) throw error;
                toast({ title: 'Success', description: 'Timetable slot updated.' });
            } else {
                const { error } = await supabase.from('timetable').insert([payload]);
                if (error) throw error;
                toast({ title: 'Success', description: 'Timetable slot added.' });
            }

            setDialogOpen(false);
            resetForm();
            fetchData();
        } catch (error: any) {
            console.error("Save Error:", error);

            const { data: conflicts } = await (supabase.from('timetable' as any)
                .select('*, subjects(name)')
                .eq('day_of_week', parseInt(form.day_of_week))
                .filter('start_time', 'lt', form.end_time)
                .filter('end_time', 'gt', form.start_time) as any);

            let conflictMsg = error.message;
            if (error.code === '23P01' || error.message.toLowerCase().includes('exclusion')) {
                const roomConflict = conflicts?.find((c: any) => c.id !== selectedSlot?.id && c.room && c.room.toLowerCase() === form.room.toLowerCase());
                const batchConflict = conflicts?.find((c: any) =>
                    c.id !== selectedSlot?.id && c.batch && c.batch === form.batch && c.department_id === currentDeptId
                );

                if (roomConflict) {
                    conflictMsg = `Room Conflict: "${form.room}" is already booked by ${roomConflict.subjects?.name} at this time.`;
                } else if (batchConflict) {
                    conflictMsg = `Batch Conflict: ${form.batch} group already has ${batchConflict.subjects?.name} scheduled.`;
                } else {
                    conflictMsg = "Exclusion Conflict: Overlapping time found for the same room or class group.";
                }
            }

            toast({
                title: 'Schedule Overlap',
                description: conflictMsg,
                variant: 'destructive'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditSlot = (slot: any) => {
        setSelectedSlot(slot);
        setForm({
            subject_id: slot.subject_id,
            day_of_week: slot.day_of_week.toString(),
            start_time: slot.start_time.slice(0, 5),
            end_time: slot.end_time.slice(0, 5),
            room: slot.room || '',
            department_id: slot.department_id || 'none',
            batch: slot.batch || ''
        });
        setDialogOpen(true);
    };

    const handleDeleteSlot = async (id: string) => {
        if (!confirm('Remove this lecture from timetable?')) return;
        try {
            const { error } = await supabase.from('timetable').delete().eq('id', id);
            if (error) throw error;
            toast({ title: 'Slot removed' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
        }
    };

    // Helper to render slots in the grid
    const getSlotsForDay = (dayIndex: number) => {
        return timetable.filter(slot => slot.day_of_week === dayIndex).sort((a, b) => a.start_time.localeCompare(b.start_time));
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-heading text-foreground">Academic Timetable</h1>
                        <p className="text-muted-foreground">Weekly schedule for lectures and labs</p>
                    </div>

                    <div className="flex items-center gap-2">
                        {(role === 'admin' || role === 'lecturer') && (
                            <Dialog open={dialogOpen} onOpenChange={(open) => {
                                setDialogOpen(open);
                                if (!open) resetForm();
                            }}>
                                <DialogTrigger asChild>
                                    <Button className="gradient-primary" onClick={() => {
                                        setForm(prev => ({
                                            ...prev,
                                            department_id: selectedDept,
                                            batch: selectedBatch
                                        }));
                                    }}>
                                        <Plus className="mr-2 h-4 w-4" /> Add Lecture
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle>{selectedSlot ? 'Edit Lecture' : 'Schedule New Lecture'}</DialogTitle>
                                        <DialogDescription>System checks for room and batch conflicts automatically.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleSaveSlot} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Subject</Label>
                                            <Select value={form.subject_id} onValueChange={v => setForm({ ...form, subject_id: v })} required>
                                                <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
                                                <SelectContent>
                                                    {filteredSubjects.length === 0 ? (
                                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                                            Select a department first
                                                        </div>
                                                    ) : (
                                                        filteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Department</Label>
                                                <Select value={form.department_id} onValueChange={v => setForm({ ...form, department_id: v })}>
                                                    <SelectTrigger><SelectValue placeholder="Faculty" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">General</SelectItem>
                                                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Batch</Label>
                                                <Select value={form.batch} onValueChange={v => setForm({ ...form, batch: v })}>
                                                    <SelectTrigger><SelectValue placeholder="Select Batch" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">General</SelectItem>
                                                        {batches.map(b => <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label>Day</Label>
                                                <Select value={form.day_of_week} onValueChange={v => setForm({ ...form, day_of_week: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {DAYS.map((d, i) => <SelectItem key={i} value={i.toString()}>{d}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Start</Label>
                                                <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>End</Label>
                                                <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Room / Hall</Label>
                                            <Input placeholder="e.g. Hall A-102" value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} required />
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" className="w-full gradient-primary" disabled={isSaving}>
                                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save to Timetable
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>

                {role === 'admin' && (
                    <Card className="shadow-premium border-none bg-primary/5">
                        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-6">
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-bold text-primary uppercase tracking-tight">Schedule View:</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase opacity-50 ml-1">Faculty</Label>
                                        <Select value={selectedDept} onValueChange={setSelectedDept}>
                                            <SelectTrigger className="w-[200px] h-10 bg-background border-none shadow-sm"><SelectValue placeholder="Select Department" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Choose Department</SelectItem>
                                                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] uppercase opacity-50 ml-1">Academic Year / Batch</Label>
                                        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                                            <SelectTrigger className="w-[150px] h-10 bg-background border-none shadow-sm"><SelectValue placeholder="Select Batch" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Choose Batch</SelectItem>
                                                {batches.map(b => <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {loading ? (
                    <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                        {DAYS.map((day, dayIndex) => (
                            <div key={day} className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="font-bold text-sm uppercase tracking-widest text-primary">{day}</h3>
                                    <Badge variant="secondary" className="text-[10px]">{getSlotsForDay(dayIndex).length} SES</Badge>
                                </div>
                                <div className="space-y-3 min-h-[400px] bg-muted/20 rounded-2xl p-2 border border-dashed border-muted">
                                    {getSlotsForDay(dayIndex).map((slot) => (
                                        <Card key={slot.id} className="shadow-premium border-none group relative overflow-hidden active:scale-95 transition-transform">
                                            <div className="absolute top-0 left-0 w-1 h-full gradient-primary"></div>
                                            <CardContent className="p-3">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center justify-between">
                                                  <span className="text-[10px] font-black text-primary uppercase">{slot.subjects?.code || 'N/A'}</span>
                                                  {(role === 'admin' || (role === 'lecturer' && slot.subjects?.lecturer_id === user?.id)) && (
                                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleEditSlot(slot)}
                                                                    className="text-primary hover:text-primary/70"
                                                                >
                                                                    <Pencil className="h-3 w-3" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteSlot(slot.id)}
                                                                    className="text-destructive hover:text-destructive/70"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <h4 className="font-bold text-xs line-clamp-2 leading-tight">{slot.subjects?.name || 'Unassigned'}</h4>
                                                    <div className="flex flex-col gap-1 mt-1">
                                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                            <Clock className="h-3 w-3" />
                                                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                                                            <MapPin className="h-3 w-3" />
                                                            {slot.room}
                                                        </div>
                                                    </div>
                                                    {role === 'admin' && (
                                                        <div className="mt-2 pt-2 border-t border-dashed flex items-center justify-between">
                                                            <Badge variant="outline" className="text-[9px] uppercase">{slot.batch || 'Gen'}</Badge>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    {getSlotsForDay(dayIndex).length === 0 && (
                                        <div className="flex flex-col items-center justify-center p-10 opacity-20 filter grayscale">
                                            <CalendarIcon className="h-8 w-8 mb-2" />
                                            <span className="text-[10px] font-bold">Free Day</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default Timetable;
