import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Award, BookOpen, GraduationCap, Download, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MyGrades = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [grades, setGrades] = useState<any[]>([]);
    const [assignmentGrades, setAssignmentGrades] = useState<any[]>([]);
    const [gpaData, setGpaData] = useState<any>(null);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // 1. Fetch published grades with subject details
            const [gradeRes, gpaRes, submissionRes] = await Promise.all([
                supabase
                    .from('grades' as any)
                    .select('*, subjects(name, code, credits)')
                    .eq('student_id', user.id)
                    .eq('is_published', true),
                supabase
                    .from('student_semester_gpa' as any)
                    .select('*')
                    .eq('student_id', user.id)
                    .single(),
                supabase
                    .from('submissions')
                    .select('*, assignments(title, max_marks, subjects(name, code))')
                    .eq('student_id', user.id)
            ]);

            if (gradeRes.error) throw gradeRes.error;
            setGrades(gradeRes.data || []);
            setGpaData(gpaRes.data);
            setAssignmentGrades(submissionRes.data || []);
        } catch (error: any) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-heading">Academic Results</h1>
                        <p className="text-muted-foreground">View your final grades and GPA performance</p>
                    </div>
                    <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                        <Download className="mr-2 h-4 w-4" /> Download Transcript
                    </Button>
                </div>

                {loading ? (
                    <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Summary Stats */}
                        <Card className="shadow-premium border-none bg-primary text-primary-foreground overflow-hidden">
                            <CardHeader className="relative z-10">
                                <CardTitle className="flex items-center gap-2">
                                    <Calculator className="h-5 w-5" />
                                    Current Semester GPA
                                </CardTitle>
                                <div className="text-5xl font-black mt-4">
                                    {gpaData?.sgpa?.toFixed(2) || '0.00'}
                                </div>
                                <div className="text-primary-foreground/70 text-sm mt-2 font-medium">
                                    Out of 4.00 Credits: {gpaData?.total_credits || 0}
                                </div>
                            </CardHeader>
                            <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
                                <Award size={160} />
                            </div>
                        </Card>

                        <Card className="shadow-premium border-none bg-secondary text-secondary-foreground overflow-hidden">
                            <CardHeader className="relative z-10">
                                <CardTitle className="flex items-center gap-2">
                                    <GraduationCap className="h-5 w-5" />
                                    Cumulative GPA
                                </CardTitle>
                                <div className="text-5xl font-black mt-4">
                                    {gpaData?.sgpa?.toFixed(2) || '0.00'}
                                </div>
                                <div className="text-secondary-foreground/70 text-sm mt-2 font-medium">
                                    Academic Standing: {gpaData?.sgpa >= 3.5 ? 'Excellent' : gpaData?.sgpa >= 3.0 ? 'Good' : 'Satisfactory'}
                                </div>
                            </CardHeader>
                            <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
                                <BookOpen size={160} />
                            </div>
                        </Card>

                        <div className="md:col-span-1 space-y-4">
                            <div className="bg-success/10 p-4 rounded-xl border border-success/20 flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center text-success">
                                    <Award />
                                </div>
                                <div>
                                    <div className="text-sm font-bold uppercase text-success/70 tracking-tighter">Subjects Cleared</div>
                                    <div className="text-2xl font-black">{grades.filter(g => g.letter_grade !== 'F').length}</div>
                                </div>
                            </div>
                            <div className="bg-primary/10 p-4 rounded-xl border border-primary/20 flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                    <BookOpen />
                                </div>
                                <div>
                                    <div className="text-sm font-bold uppercase text-primary/70 tracking-tighter">Current Semester</div>
                                    <div className="text-2xl font-black">{gpaData?.semester || 'Semester 1'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Grade Table */}
                        <Card className="md:col-span-3 shadow-card border-none">
                            <CardHeader>
                                <CardTitle>Statement of Results</CardTitle>
                                <CardDescription>Detailed course-wise academic performance</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead>Course Code</TableHead>
                                            <TableHead>Subject Name</TableHead>
                                            <TableHead className="text-center">Credits</TableHead>
                                            <TableHead className="text-center">Grade</TableHead>
                                            <TableHead className="text-center">Points</TableHead>
                                            <TableHead className="text-right">Result</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {grades.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                                    Results have not been published for this semester yet.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            grades.map((grade) => (
                                                <TableRow key={grade.id}>
                                                    <TableCell className="font-mono font-bold text-xs">{grade.subjects.code}</TableCell>
                                                    <TableCell className="font-medium">{grade.subjects.name}</TableCell>
                                                    <TableCell className="text-center">{grade.subjects.credits}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className={`font-black ${grade.grade_point >= 2.0 ? 'border-success text-success' : 'border-destructive text-destructive'}`}>
                                                            {grade.letter_grade}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono">{grade.grade_point.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">
                                                        {grade.grade_point >= 1.0 ? (
                                                            <span className="text-success font-bold text-sm">PASSED</span>
                                                        ) : (
                                                            <span className="text-destructive font-bold text-sm">FAILED</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Assignment Table */}
                        <Card className="md:col-span-3 shadow-card border-none">
                            <CardHeader>
                                <CardTitle>Assignment Performance</CardTitle>
                                <CardDescription>Marks obtained in continuous assessments</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead>Course</TableHead>
                                            <TableHead>Assignment Title</TableHead>
                                            <TableHead className="text-center">Marks Obtained</TableHead>
                                            <TableHead className="text-center">Percentage</TableHead>
                                            <TableHead className="text-right">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {assignmentGrades.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                                    No assignment submissions found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            assignmentGrades.map((sub) => {
                                                const maxMarks = sub.assignments?.max_marks || 100;
                                                const marks = sub.marks !== null ? sub.marks : 0;
                                                const percentage = Math.round((marks / maxMarks) * 100);
                                                const isGraded = sub.marks !== null;

                                                return (
                                                    <TableRow key={sub.id}>
                                                        <TableCell className="font-mono text-xs font-bold">
                                                            {sub.assignments?.subjects?.code}
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            {sub.assignments?.title}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {isGraded ? (
                                                                <span className="font-bold">{sub.marks} / {maxMarks}</span>
                                                            ) : (
                                                                <span className="text-muted-foreground italic">Pending</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {isGraded ? (
                                                                <div className="flex flex-col gap-1 items-center">
                                                                    <div className="w-24 bg-muted h-1.5 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full ${percentage >= 40 ? 'bg-success' : 'bg-destructive'}`}
                                                                            style={{ width: `${percentage}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-[10px] font-bold">{percentage}%</span>
                                                                </div>
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {isGraded ? (
                                                                <Badge className="bg-success">Graded</Badge>
                                                            ) : (
                                                                <Badge variant="secondary">Submitted</Badge>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default MyGrades;
