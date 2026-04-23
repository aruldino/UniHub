import { useEffect, useState } from 'react';
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
import { Loader2, Save, Send, BookOpen } from 'lucide-react';
import { Label } from '@/components/ui/label';

/** Table 1: Grade and point values (Faculty of Humanities & Social Sciences, 2014) */
const GRADE_POINT_SCALE: { range: string; grade: string; point: number }[] = [
    { range: '85 – 100', grade: 'A+', point: 4.0 },
    { range: '70 – 84', grade: 'A', point: 4.0 },
    { range: '65 – 69', grade: 'A-', point: 3.7 },
    { range: '60 – 64', grade: 'B+', point: 3.3 },
    { range: '55 – 59', grade: 'B', point: 3.0 },
    { range: '50 – 54', grade: 'B-', point: 2.7 },
    { range: '45 – 49', grade: 'C+', point: 2.3 },
    { range: '40 – 44', grade: 'C', point: 2.0 },
    { range: '35 – 39', grade: 'C-', point: 1.7 },
    { range: '30 – 34', grade: 'D+', point: 1.3 },
    { range: '25 – 29', grade: 'D', point: 1.0 },
    { range: '00 – 24', grade: 'E', point: 0.0 },
];

const Grading = () => {
    const { user, role } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [subjects, setSubjects] = useState<any[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [students, setStudents] = useState<any[]>([]);
    const [grades, setGrades] = useState<Record<string, any>>({});

    const currentYear = new Date().getFullYear().toString();
    const currentSemester = "Semester 1";

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch subjects assigned to this lecturer
            let query = supabase.from('subjects').select('*');
            if (role === 'lecturer') {
                query = query.eq('lecturer_id', user?.id);
            }
            const { data: subData } = await (query as any);
            setSubjects(subData || []);

            if (subData && subData.length > 0) {
                setSelectedSubject(subData[0].id);
            }
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const fetchStudentsForGrading = async (subjectId: string) => {
        if (!subjectId) return;
        setLoading(true);
        try {
            // 1. Get enrolled students
            const { data: enrollmentData } = await supabase
                .from('enrollments')
                .select('student_id')
                .eq('subject_id', subjectId);

            const studentIds = enrollmentData?.map(e => e.student_id) || [];

            if (studentIds.length === 0) {
                setStudents([]);
                return;
            }

            // 2. Get profiles and existing grades
            const [profRes, gradeRes] = await Promise.all([
                supabase.from('profiles').select('user_id, full_name').in('user_id', studentIds),
                supabase.from('grades' as any).select('*').eq('subject_id', subjectId).eq('semester', currentSemester)
            ]);

            const existingGrades = Object.fromEntries(
                (gradeRes.data || []).map(g => [g.student_id, g])
            );

            const enrichedStudents = (profRes.data || []).map(p => ({
                ...p,
                grade: existingGrades[p.user_id] || {
                    marks_obtained: '',
                    letter_grade: '',
                    is_published: false
                }
            }));

            setStudents(enrichedStudents);

            // Initialize local grades state
            const initialGrades: Record<string, any> = {};
            enrichedStudents.forEach(s => {
                initialGrades[s.user_id] = { ...s.grade };
            });
            setGrades(initialGrades);

        } catch (error: any) {
            toast({ title: 'Fetch Failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user, role]);

    useEffect(() => {
        if (selectedSubject) fetchStudentsForGrading(selectedSubject);
    }, [selectedSubject]);

    const calculateGrade = (marks: number) => {
        if (marks > 100) return { letter: 'A+', point: 4.0 };
        if (marks >= 85) return { letter: 'A+', point: 4.0 };
        if (marks >= 70) return { letter: 'A', point: 4.0 };
        if (marks >= 65) return { letter: 'A-', point: 3.7 };
        if (marks >= 60) return { letter: 'B+', point: 3.3 };
        if (marks >= 55) return { letter: 'B', point: 3.0 };
        if (marks >= 50) return { letter: 'B-', point: 2.7 };
        if (marks >= 45) return { letter: 'C+', point: 2.3 };
        if (marks >= 40) return { letter: 'C', point: 2.0 };
        if (marks >= 35) return { letter: 'C-', point: 1.7 };
        if (marks >= 30) return { letter: 'D+', point: 1.3 };
        if (marks >= 25) return { letter: 'D', point: 1.0 };
        return { letter: 'E', point: 0.0 };
    };

    const handleMarksChange = (studentId: string, marks: string) => {
        const numericMarks = parseFloat(marks);
        if (isNaN(numericMarks)) {
            setGrades({
                ...grades,
                [studentId]: { ...grades[studentId], marks_obtained: marks, letter_grade: '', grade_point: 0 }
            });
            return;
        }

        const { letter, point } = calculateGrade(numericMarks);
        setGrades({
            ...grades,
            [studentId]: {
                ...grades[studentId],
                marks_obtained: marks,
                letter_grade: letter,
                grade_point: point
            }
        });
    };

    const saveGrades = async (publish: boolean = false) => {
        setSaving(true);
        try {
            const updates = Object.entries(grades).map(([studentId, data]) => ({
                student_id: studentId,
                subject_id: selectedSubject,
                marks_obtained: parseFloat(data.marks_obtained),
                letter_grade: data.letter_grade,
                grade_point: data.grade_point,
                semester: currentSemester,
                academic_year: currentYear,
                is_published: publish || data.is_published,
                created_by: user?.id
            }));

            const { error } = await (supabase.from('grades' as any).upsert(updates, {
                onConflict: 'student_id,subject_id,semester'
            }) as any);

            if (error) throw error;
            toast({ title: publish ? 'Grades Published' : 'Grades Saved' });
            fetchStudentsForGrading(selectedSubject);
        } catch (error: any) {
            toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-heading">Campus Gradebook</h1>
                        <p className="text-muted-foreground">Submit and publish academic results for your subjects</p>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => saveGrades(false)} disabled={saving || !selectedSubject}>
                            <Save className="mr-2 h-4 w-4" /> Draft
                        </Button>
                        <Button className="gradient-primary" onClick={() => saveGrades(true)} disabled={saving || !selectedSubject}>
                            <Send className="mr-2 h-4 w-4" /> Publish Results
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card className="md:col-span-1 shadow-premium border-none">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Select Course</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Assigned Subject</Label>
                                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Chose subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subjects.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4 border-t space-y-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                                        Table 1: Grade and point values for students&apos; marks
                                    </p>
                                    <p className="text-[11px] text-muted-foreground/80 leading-snug">
                                        Source: Faculty of Humanities &amp; Social Sciences, 2014
                                    </p>
                                </div>
                                <div className="rounded-lg border bg-muted/20 overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                <TableHead className="text-xs h-9">Range of marks</TableHead>
                                                <TableHead className="text-xs h-9 w-14 text-center">Grade</TableHead>
                                                <TableHead className="text-xs h-9 w-16 text-right">Point value</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {GRADE_POINT_SCALE.map((row) => (
                                                <TableRow key={row.grade + row.range} className="text-xs">
                                                    <TableCell className="py-1.5 font-mono tabular-nums">{row.range}</TableCell>
                                                    <TableCell className="py-1.5 text-center font-bold">{row.grade}</TableCell>
                                                    <TableCell className="py-1.5 text-right font-mono tabular-nums">
                                                        {row.point.toFixed(1)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-3 shadow-card border-none">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                            ) : students.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-20 text-center">
                                    <BookOpen className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                                    <h3 className="text-xl font-bold">No Students Enrolled</h3>
                                    <p className="text-muted-foreground">No students are currently enrolled in this subject.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Student</TableHead>
                                            <TableHead className="w-32 text-center">Marks (%)</TableHead>
                                            <TableHead className="w-24 text-center">Grade</TableHead>
                                            <TableHead className="w-24 text-center">Points</TableHead>
                                            <TableHead className="text-right">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {students.map(student => (
                                            <TableRow key={student.user_id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold">
                                                            {student.full_name?.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <span className="font-semibold">{student.full_name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        className="text-center font-mono font-bold"
                                                        placeholder="0-100"
                                                        value={grades[student.user_id]?.marks_obtained ?? ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 100)) {
                                                                handleMarksChange(student.user_id, val);
                                                            }
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className={`font-black ${grades[student.user_id]?.grade_point >= 2.0 ? 'text-success' : 'text-destructive'}`}>
                                                        {grades[student.user_id]?.letter_grade || '—'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center font-mono font-bold">
                                                    {grades[student.user_id]?.grade_point?.toFixed(1) || '0.0'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {grades[student.user_id]?.is_published ? (
                                                        <Badge className="bg-success">Published</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Draft</Badge>
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
            </div>
        </DashboardLayout>
    );
};

export default Grading;
