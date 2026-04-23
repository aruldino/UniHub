import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, BookOpen, ChevronRight, Search, Loader2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const FacultyAssignment = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [lecturers, setLecturers] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [selectedLecturer, setSelectedLecturer] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Lecturers: user_roles → profiles (no direct FK for a profiles↔user_roles embed)
            const { data: lecturerRoles, error: lrErr } = await supabase
                .from('user_roles')
                .select('user_id')
                .eq('role', 'lecturer');
            if (lrErr) throw lrErr;

            const lecturerIds = [...new Set((lecturerRoles ?? []).map((r) => r.user_id))];

            let profs: any[] = [];
            if (lecturerIds.length > 0) {
                const { data: profRows, error: pErr } = await supabase
                    .from('profiles')
                    .select('id, user_id, full_name, email, is_active')
                    .in('user_id', lecturerIds)
                    .eq('is_active', true)
                    .order('full_name', { ascending: true });
                if (pErr) throw pErr;
                profs = profRows ?? [];
            }

            // 2. Fetch Subjects
            const { data: subjs, error: subErr } = await (supabase.from('subjects') as any)
                .select('*, departments(name)');
            if (subErr) throw subErr;

            setLecturers(profs || []);
            setSubjects(subjs || []);

            if (profs && profs.length > 0 && !selectedLecturer) {
                setSelectedLecturer(profs[0]);
            }
        } catch (error: any) {
            toast({ title: 'Fetch Failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleAssignment = async (subjectId: string, isAssigned: boolean) => {
        if (!selectedLecturer) return;

        try {
            const { error } = await supabase
                .from('subjects')
                .update({ lecturer_id: isAssigned ? null : selectedLecturer.user_id } as any)
                .eq('id', subjectId);

            if (error) throw error;

            // Local update for snappier UI
            setSubjects(prev => prev.map(s =>
                s.id === subjectId ? { ...s, lecturer_id: isAssigned ? null : selectedLecturer.user_id } : s
            ));

            toast({
                title: isAssigned ? 'Assignment Removed' : 'Faculty Assigned',
                description: isAssigned ? 'Subject is now unassigned.' : `Subject assigned to ${selectedLecturer.full_name}`
            });
        } catch (error: any) {
            toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
        }
    };

    const filteredLecturers = lecturers.filter(l =>
        l.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const lecturerSubjects = subjects.filter(s => s.lecturer_id === selectedLecturer?.user_id);
    const availableSubjects = subjects.filter(s => !s.lecturer_id);

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-heading">Faculty Course Load</h1>
                        <p className="text-muted-foreground text-sm">Designate lecturers to specific academic subjects.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Lecturer List */}
                    <Card className="lg:col-span-1 shadow-premium border-none">
                        <CardHeader className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search Faculty..."
                                    className="pl-9 h-9 text-xs"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y max-h-[600px] overflow-y-auto">
                                {loading && <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>}
                                {!loading && filteredLecturers.map(l => (
                                    <button
                                        key={l.id}
                                        onClick={() => setSelectedLecturer(l)}
                                        className={`w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors ${selectedLecturer?.id === l.id ? 'bg-primary/5 border-r-2 border-primary' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                                                {l.full_name?.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold truncate max-w-[120px]">{l.full_name}</p>
                                                <p className="text-[10px] text-muted-foreground">{subjects.filter(s => s.lecturer_id === l.user_id).length} Courses</p>
                                            </div>
                                        </div>
                                        <ChevronRight className={`h-4 w-4 transition-transform ${selectedLecturer?.id === l.id ? 'translate-x-1 text-primary' : 'opacity-20'}`} />
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Assignment Interface */}
                    <div className="lg:col-span-3 space-y-6">
                        {selectedLecturer ? (
                            <>
                                <Card className="shadow-premium border-none overflow-hidden">
                                    <div className="h-24 bg-gradient-to-r from-primary to-indigo-600"></div>
                                    <CardContent className="relative -mt-12 p-6">
                                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                            <div className="flex items-end gap-4">
                                                <div className="h-20 w-20 rounded-2xl bg-background shadow-xl p-1">
                                                    <div className="h-full w-full rounded-xl bg-muted flex items-center justify-center text-2xl font-black text-primary">
                                                        {selectedLecturer.full_name?.slice(0, 2).toUpperCase()}
                                                    </div>
                                                </div>
                                                <div className="pb-1">
                                                    <h2 className="text-2xl font-bold font-heading">{selectedLecturer.full_name}</h2>
                                                    <p className="text-sm text-muted-foreground">{selectedLecturer.email}</p>
                                                </div>
                                            </div>
                                            <Badge variant="secondary" className="mb-1 h-7 px-3 text-xs uppercase font-black tracking-widest">
                                                Active Faculty
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Assigned Subjects */}
                                    <Card className="shadow-card border-none bg-green-50/20 dark:bg-green-950/5">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-bold text-green-600 flex items-center gap-2">
                                                <Users className="h-4 w-4" /> CURRENT ASSIGNMENTS ({lecturerSubjects.length})
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {lecturerSubjects.length === 0 ? (
                                                <p className="text-xs text-muted-foreground italic p-4 text-center border rounded-lg bg-background/50">No courses assigned yet.</p>
                                            ) : (
                                                lecturerSubjects.map(s => (
                                                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-background border shadow-sm group">
                                                        <div>
                                                            <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">{s.code}</p>
                                                            <p className="text-sm font-bold">{s.name}</p>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:bg-destructive/5 h-8 text-xs font-bold"
                                                            onClick={() => toggleAssignment(s.id, true)}
                                                        >
                                                            Unassign
                                                        </Button>
                                                    </div>
                                                ))
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Available Subjects */}
                                    <Card className="shadow-card border-none bg-primary/5">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                                                <BookOpen className="h-4 w-4" /> AVAILABLE COURSES
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {availableSubjects.map(s => (
                                                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-background border shadow-sm hover:border-primary/30 transition-colors">
                                                    <div>
                                                        <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">{s.code}</p>
                                                        <p className="text-sm font-bold">{s.name}</p>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-[10px] uppercase font-black tracking-tighter hover:bg-primary hover:text-white"
                                                        onClick={() => toggleAssignment(s.id, false)}
                                                    >
                                                        Assign Course
                                                    </Button>
                                                </div>
                                            ))}
                                            {availableSubjects.length === 0 && <p className="text-xs text-center text-muted-foreground py-10">No available courses for assignment.</p>}
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        ) : (
                            <div className="h-[600px] flex flex-col items-center justify-center opacity-30">
                                <Users className="h-16 w-16 mb-4" />
                                <h3 className="text-xl font-bold">Select a Faculty Member</h3>
                                <p>Begin assigning courses by selecting a lecturer from the sidebar.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default FacultyAssignment;
