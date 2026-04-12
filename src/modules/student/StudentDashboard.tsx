import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  GraduationCap, Timer, FileCheck, Award, MessageSquare, BookOpen, Calendar, FileText, ClipboardCheck,
} from 'lucide-react';

const StudentDashboard = () => {
    const { user, profile } = useAuth();
    const [stats, setStats] = useState({ enrollments: 0, attendance: 0, gpa: 0 });
    const [results, setResults] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);

    useEffect(() => {
        const fetchStudentStats = async () => {
            if (!user) return;
            try {
                // Enrollment count
                const { count: enrollCount } = await supabase
                    .from('enrollments' as any)
                    .select('*', { count: 'exact', head: true })
                    .eq('student_id', user.id);

                // Attendance calculation
                const { data: attData } = await supabase
                    .from('attendance' as any)
                    .select('status')
                    .eq('student_id', user.id) as any;

                const totalClasses = attData?.length || 0;
                const presentCount = attData?.filter((a: any) => a.status === 'present').length || 0;
                const attendancePct = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

                // GPA Calculation (Average of grade_point from grades table)
                const { data: gradeData } = await supabase
                    .from('grades' as any)
                    .select('grade_point, letter_grade, subjects(name)')
                    .eq('student_id', user.id) as any;

                const totalPoints = gradeData?.reduce((acc: number, curr: any) => acc + (curr.grade_point || 0), 0) || 0;
                const avgGpa = gradeData?.length ? (totalPoints / gradeData.length).toFixed(1) : '0.0';

                setStats({
                    enrollments: enrollCount || 0,
                    attendance: attendancePct,
                    gpa: Number(avgGpa)
                });
                setResults(gradeData || []);

                // Fetch Joined Groups for Preview
                const { data: grpData } = await supabase
                    .from('groups' as any)
                    .select('*, group_members!inner(*)')
                    .eq('group_members.user_id', user.id)
                    .limit(3) as any;
                setGroups(grpData || []);

                // Fetch Recent Graded Submissions
                const { data: subData } = await supabase
                    .from('submissions')
                    .select('*, assignments(title, subjects(code))')
                    .eq('student_id', user.id)
                    .not('marks', 'is', null)
                    .order('submitted_at', { ascending: false })
                    .limit(3);
                setRecentSubmissions(subData || []);

            } catch (error) {
                console.error('Student stats fetch error:', error);
            }
        };
        fetchStudentStats();
    }, [user]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
                <Card className="flex-1 gradient-primary text-primary-foreground border-none">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-4">
                                <div className="p-2 bg-white/20 rounded-lg w-fit"><GraduationCap className="h-6 w-6" /></div>
                                <div>
                                    <h2 className="text-2xl font-black">Welcome back, {profile?.full_name?.split(' ')[0]}!</h2>
                                    <p className="text-primary-foreground/80 text-sm">You have some upcoming activities in your {(profile as any)?.batch} batch.</p>
                                </div>
                            </div>
                            <div className="hidden sm:block opacity-20"><Timer className="h-24 w-24" /></div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4 w-full sm:w-[400px]">
                    <QuickStat title="Active Courses" value={stats.enrollments} icon={FileCheck} />
                    <QuickStat title="Attendance" value={`${stats.attendance}%`} icon={Award} />
                </div>
            </div>

            <Card className="border-none shadow-premium bg-gradient-to-r from-primary/5 to-primary/10">
                <CardHeader>
                    <CardTitle className="text-lg font-bold font-heading">Your learning</CardTitle>
                    <CardDescription>Courses, schedule, assignments, and results</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[
                            { to: '/subjects', label: 'Subjects', icon: BookOpen },
                            { to: '/timetable', label: 'Timetable', icon: Calendar },
                            { to: '/assignments', label: 'Assignments', icon: FileText },
                            { to: '/attendance', label: 'Attendance', icon: ClipboardCheck },
                            { to: '/exams', label: 'Exams', icon: GraduationCap },
                            { to: '/results', label: 'My results', icon: Award },
                        ].map(({ to, label, icon: Icon }) => (
                            <Link
                                key={to}
                                to={to}
                                className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 text-center transition-all hover:border-primary/30 hover:shadow-lg"
                            >
                                <Icon className="mb-2 h-6 w-6 text-primary" />
                                <span className="text-xs font-bold uppercase tracking-tight text-slate-700">{label}</span>
                            </Link>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <span>My Academic Record</span>
                            <Badge variant="outline" className="text-primary font-black">GPA: {stats.gpa}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {results.length > 0 ? results.map((res: any, i: number) => (
                                <ResultItem
                                    key={i}
                                    subject={res.subjects?.name || 'Unknown'}
                                    grade={res.letter_grade || 'N/A'}
                                    status="Completed"
                                />
                            )) : (
                                <div className="p-8 text-center text-muted-foreground italic text-sm">No academic records found yet.</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Messages & Groups</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {groups.length > 0 ? groups.map((g: any) => (
                            <div key={g.id} className="flex gap-4 p-3 rounded-xl hover:bg-muted transition-all cursor-pointer border border-dashed border-primary/20 group">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><MessageSquare className="h-5 w-5" /></div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold truncate">{g.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{g.last_message_content || g.description || 'No recent activity'}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-6 text-muted-foreground text-xs italic">
                                <p>You haven't joined any groups yet.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Assignment Grades</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {recentSubmissions.length > 0 ? recentSubmissions.map((sub: any) => (
                            <div key={sub.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-transparent hover:border-primary/20 transition-all">
                                <div>
                                    <p className="text-xs font-bold text-primary uppercase">{sub.assignments?.subjects?.code}</p>
                                    <p className="text-sm font-semibold truncate max-w-[150px]">{sub.assignments?.title}</p>
                                </div>
                                <div className="text-right">
                                    <Badge variant="default" className="bg-success font-black">
                                        {sub.marks}
                                    </Badge>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-6 text-muted-foreground text-xs italic">
                                <p>No graded assignments yet.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const QuickStat = ({ title, value, icon: Icon }: any) => (
    <Card className="flex flex-col items-center justify-center p-4 text-center border-none shadow-premium bg-card/50 backdrop-blur hover:translate-y-[-2px] transition-all">
        <Icon className="h-6 w-6 text-primary mb-2" />
        <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{title}</span>
        <h4 className="text-xl font-black">{value}</h4>
    </Card>
);

const ResultItem = ({ subject, grade, status }: any) => (
    <div className="flex items-center justify-between p-4 px-6 hover:bg-muted/30 transition-colors">
        <div className="flex flex-col">
            <span className="font-bold text-sm">{subject}</span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">{status}</span>
        </div>
        <Badge className={grade === 'A' ? 'bg-primary hover:bg-primary/80' : 'bg-secondary hover:bg-secondary/80'}>{grade}</Badge>
    </div>
);

export default StudentDashboard;
