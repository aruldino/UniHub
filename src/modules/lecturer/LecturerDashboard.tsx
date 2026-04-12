import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BookOpen, ClipboardCheck, GraduationCap, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

const LecturerDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ subjects: 0, pendingGrading: 0, totalStudents: 0 });
    const [schedule, setSchedule] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);

    useEffect(() => {
        const fetchLecturerStats = async () => {
            if (!user) return;
            try {
                // Fetch assigned subjects
                const { data: subs } = await supabase.from('subjects').select('id').eq('lecturer_id', user.id);
                const subIds = subs?.map(s => s.id) || [];

                // Fetch student count across all subjects
                const { count: studentCount } = await supabase
                    .from('enrollments' as any)
                    .select('*', { count: 'exact', head: true })
                    .in('subject_id', subIds);

                // Fetch pending submissions (mock logic: any submission with null grade)
                const { count: pendingCount } = await supabase
                    .from('submissions' as any)
                    .select('*', { count: 'exact', head: true })
                    .is('marks', null);

                setStats({
                    subjects: subIds.length,
                    pendingGrading: pendingCount || 0,
                    totalStudents: studentCount || 0
                });

                // Fetch Today's Schedule
                const today = new Date().getDay(); // 0 (Sun) to 6 (Sat)
                const { data: schedData } = await supabase
                    .from('timetable')
                    .select('*, subjects(name)')
                    .eq('day_of_week', today)
                    .in('subject_id', subIds)
                    .order('start_time', { ascending: true });
                setSchedule(schedData || []);

                // Fetch Notifications
                const { data: notifData } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(5);
                setNotifications(notifData || []);

            } catch (error) {
                console.error('Lecturer stats fetch error:', error);
            }
        };
        fetchLecturerStats();
    }, [user]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <LecStatCard title="Assigned Subjects" value={stats.subjects} icon={BookOpen} color="bg-blue-500" />
                <LecStatCard title="To Grade" value={stats.pendingGrading} icon={ClipboardCheck} color="bg-primary" />
                <LecStatCard title="Total Students" value={stats.totalStudents} icon={GraduationCap} color="bg-green-500" />
            </div>

            <Card className="border-none shadow-premium bg-gradient-to-r from-primary/5 to-primary/10">
                <CardHeader>
                    <CardTitle className="text-lg font-bold font-heading">Academic Hub</CardTitle>
                    <CardDescription>Quick access to your academic management tools</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        <QuickActionLink to="/subjects" icon={BookOpen} label="Subjects" color="text-blue-600" />
                        <QuickActionLink to="/grading" icon={CheckCircle2} label="Grading" color="text-primary" />
                        <QuickActionLink to="/attendance" icon={ClipboardCheck} label="Attendance" color="text-green-600" />
                        <QuickActionLink to="/timetable" icon={Clock} label="Timetable" color="text-orange-600" />
                        <QuickActionLink to="/exams" icon={GraduationCap} label="Exams" color="text-purple-600" />
                        <QuickActionLink to="/assignments" icon={AlertCircle} label="Assignments" color="text-red-600" />
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Classes</CardTitle>
                        <CardDescription>Your schedule for today</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {schedule.length > 0 ? schedule.map((item: any) => (
                            <ClassItem
                                key={item.id}
                                time={item.start_time?.slice(0, 5)}
                                subject={item.subjects?.name}
                                room={item.room}
                            />
                        )) : (
                            <p className="text-center text-muted-foreground py-4 italic text-sm">No classes scheduled for today.</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {notifications.length > 0 ? notifications.map((n: any) => (
                            <div key={n.id} className="flex gap-3 items-start border-b border-muted pb-3 last:border-0">
                                {n.type === 'info' ? <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" /> : <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />}
                                <div>
                                    <p className="text-xs font-bold uppercase text-muted-foreground">{n.title}</p>
                                    <p className="text-sm">{n.message || n.content}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        )) : (
                            <p className="text-center text-muted-foreground py-4 italic text-sm">No recent notifications.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const LecStatCard = ({ title, value, icon: Icon, color }: any) => (
    <Card className="shadow-lg border-none overflow-hidden group">
        <div className={`h-1.5 ${color}`} />
        <CardContent className="pt-6">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${color} text-white`}>
                    <Icon className="h-6 w-6" />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase">{title}</p>
                    <h3 className="text-2xl font-black">{value}</h3>
                </div>
            </div>
        </CardContent>
    </Card>
);

const ClassItem = ({ time, subject, room }: any) => (
    <div className="flex justify-between items-center p-3 rounded-xl bg-muted/50 border">
        <div className="flex items-center gap-3">
            <div className="text-xs font-bold bg-primary text-primary-foreground px-2 py-1 rounded-md">{time}</div>
            <p className="font-semibold text-sm">{subject}</p>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{room}</span>
    </div>
);

const QuickActionLink = ({ to, icon: Icon, label, color }: { to: string; icon: React.ElementType; label: string; color: string }) => (
    <Link
        to={to}
        className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-slate-200 hover:border-primary/30 hover:shadow-lg transition-all duration-300 group"
    >
        <div className={`p-3 rounded-xl bg-slate-50 group-hover:bg-primary/5 transition-colors mb-2`}>
            <Icon className={`h-6 w-6 ${color}`} />
        </div>
        <span className="text-xs font-bold text-slate-700 uppercase tracking-tighter">{label}</span>
    </Link>
);

export default LecturerDashboard;
