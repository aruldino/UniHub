import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Send, Megaphone, MessageSquare, Bell, Search,
    MoreVertical, User, Terminal, Loader2, Plus,
    AlertCircle, Check, Trash2, Clock, Globe, BookOpen
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const Communication = () => {
    const { user, role } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Form states
    const [isAnnOpen, setIsAnnOpen] = useState(false);
    const [annForm, setAnnForm] = useState({ title: '', content: '', priority: 'normal', target: 'global', subject_id: '' });
    const [msgInput, setMsgInput] = useState('');
    const [activeSubject, setActiveSubject] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch relevant subjects
            let subQuery = supabase.from('subjects').select('id, name, code');
            if (role === 'lecturer') subQuery = subQuery.eq('lecturer_id', user?.id);
            
            let subs;
            if (role === 'student') {
                const { data: enrolls } = await supabase.from('enrollments').select('subject_id').eq('student_id', user?.id);
                const enrolledIds = enrolls?.map(e => e.subject_id) || [];
                if (enrolledIds.length > 0) {
                    const { data: studentSubs } = await supabase.from('subjects').select('id, name, code').in('id', enrolledIds);
                    subs = studentSubs || [];
                } else {
                    subs = [];
                }
            } else {
                const { data } = await subQuery;
                subs = data || [];
            }
            setSubjects(subs || []);
            if (subs && subs.length > 0) setActiveSubject(subs[0].id);

            // 2. Fetch Announcements
            const { data: anns } = await (supabase.from('announcements' as any)
                .select('*, sender:profiles!announcements_sender_id_fkey(full_name), subjects(name)')
                .order('created_at', { ascending: false }) as any);
            setAnnouncements(anns || []);

            // 3. Fetch Messages (for chosen subject context)
            if (activeSubject || subs?.[0]?.id) {
                const targetId = activeSubject || subs?.[0]?.id;
                const { data: msgs } = await (supabase.from('direct_messages' as any)
                    .select('*, sender:profiles!direct_messages_sender_id_fkey(full_name)')
                    .eq('subject_id', targetId)
                    .order('created_at', { ascending: true }) as any);
                setMessages(msgs || []);
            }
        } catch (error: any) {
            toast({ title: 'Fetch failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const fetchSubjectMessages = async (targetId: string) => {
        try {
            const { data: msgs } = await (supabase.from('direct_messages' as any)
                .select('*, sender:profiles!direct_messages_sender_id_fkey(full_name)')
                .eq('subject_id', targetId)
                .order('created_at', { ascending: true }) as any);
            setMessages(msgs || []);
        } catch (error: any) {
            console.error('Chat fetch error:', error);
        }
    };

    useEffect(() => {
        if (user) fetchData();

        // REALTIME SUBSCRIPTION
        const annChannel = supabase
            .channel('public:announcements')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => {
                fetchData();
                toast({ title: 'New Announcement!', description: 'The notice board has been updated.' });
            })
            .subscribe();

    }, [user]);

    useEffect(() => {
        if (!activeSubject) return;

        fetchSubjectMessages(activeSubject);

        // Realtime listener for this specific subject chat
        const msgChannel = supabase
            .channel(`subject_chat_${activeSubject}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'direct_messages',
                filter: `subject_id=eq.${activeSubject}`
            }, () => {
                fetchSubjectMessages(activeSubject);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(msgChannel);
        };
    }, [activeSubject]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handlePostAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsActionLoading(true);

        // Validate title - min 10, max 80 characters
        if (annForm.title.length < 10 || annForm.title.length > 80) {
            toast({ title: 'Invalid title', description: 'Title must be 10-80 characters.', variant: 'destructive' });
            setIsActionLoading(false);
            return;
        }

        // Validate content - min 15 characters
        if (annForm.content.length < 15) {
            toast({ title: 'Invalid content', description: 'Content must be at least 15 characters.', variant: 'destructive' });
            setIsActionLoading(false);
            return;
        }

        try {
            const { error } = await supabase.from('announcements' as any).insert([{
                sender_id: user?.id,
                title: annForm.title,
                content: annForm.content,
                target_type: annForm.target,
                priority: annForm.priority,
                subject_id: annForm.target === 'subject' ? annForm.subject_id : null
            } as any]);

            if (error) throw error;
            setIsAnnOpen(false);
            toast({ title: 'Announcement Published' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!msgInput.trim() || !activeSubject) return;

        try {
            const { error } = await supabase.from('direct_messages' as any).insert([{
                sender_id: user?.id,
                subject_id: activeSubject,
                content: msgInput
            } as any]);

            if (error) throw error;
            setMsgInput('');
            fetchSubjectMessages(activeSubject);
        } catch (error: any) {
            toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
        }
    };

    const handleDeleteAnnouncement = async (id: string) => {
        if (!confirm('Are you sure you want to delete this notice?')) return;
        try {
            const { error } = await supabase.from('announcements' as any).delete().eq('id', id);
            if (error) throw error;
            toast({ title: 'Notice Deleted' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
        }
    };

    return (
        <DashboardLayout>
            <div className="h-[calc(100vh-140px)] flex flex-col space-y-4 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-heading">Academy Commons</h1>
                        <p className="text-muted-foreground text-sm tracking-tight">Broadcast notices and collaborate in real-time.</p>
                    </div>

                    {role === 'admin' && (
                        <div className="flex gap-2">
                            <Dialog open={isAnnOpen} onOpenChange={setIsAnnOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gradient-primary shadow-premium">
                                        <Megaphone className="mr-2 h-4 w-4" /> Blast Announcement
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle>Compose Announcement</DialogTitle>
                                        <DialogDescription>Your message will be broadcasted to the selected audience.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handlePostAnnouncement} className="space-y-4">
<div className="space-y-2">
                                            <Label>Notice Title <span className="text-[10px] text-muted-foreground">(10-80 chars)</span></Label>
                                            <Input
                                                placeholder="e.g. Campus Holiday Notice"
                                                value={annForm.title}
                                                onChange={e => setAnnForm({ ...annForm, title: e.target.value.slice(0, 80) })}
                                                maxLength={80}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Content <span className="text-[10px] text-muted-foreground">(min 15 chars)</span></Label>
                                            <Input
                                                className="min-h-[100px]"
                                                placeholder="Write your announcement here..."
                                                value={annForm.content}
                                                onChange={e => setAnnForm({ ...annForm, content: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Target Audience</Label>
                                                <Select value={annForm.target} onValueChange={v => setAnnForm({ ...annForm, target: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="global">Global (All)</SelectItem>
                                                        <SelectItem value="subject">Subject Specific</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Priority</Label>
                                                <Select value={annForm.priority} onValueChange={v => setAnnForm({ ...annForm, priority: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="normal">Normal</SelectItem>
                                                        <SelectItem value="high">High</SelectItem>
                                                        <SelectItem value="urgent">Urgent</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        {annForm.target === 'subject' && (
                                            <div className="space-y-2">
                                                <Label>Select Subject</Label>
                                                <Select value={annForm.subject_id} onValueChange={v => setAnnForm({ ...annForm, subject_id: v })} required>
                                                    <SelectTrigger><SelectValue placeholder="Choose subject" /></SelectTrigger>
                                                    <SelectContent>
                                                        {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                        <DialogFooter>
                                            <Button type="submit" className="w-full gradient-primary" disabled={isActionLoading}>
                                                {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Dispatch Notice
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </div>

                <Tabs defaultValue="announcements" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="w-full justify-start h-12 bg-muted/50 p-1 border">
                        <TabsTrigger value="announcements" className="flex items-center gap-2 px-6">
                            <Megaphone className="h-4 w-4" /> Announcements
                        </TabsTrigger>
                        <TabsTrigger value="messages" className="flex items-center gap-2 px-6">
                            <MessageSquare className="h-4 w-4" /> Subject Chat
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="announcements" className="flex-1 overflow-y-auto mt-4 pr-2">
                        <div className="space-y-4">
                            {announcements.length === 0 ? (
                                <Card className="border-dashed py-20 text-center text-muted-foreground">
                                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-10" />
                                    <p>The notice board is currently empty.</p>
                                </Card>
                            ) : (
                                announcements.map((ann) => (
                                    <Card key={ann.id} className="shadow-premium border-none relative overflow-hidden group">
                                        {ann.priority === 'urgent' && <div className="absolute top-0 left-0 bottom-0 w-1 bg-destructive" />}
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                                                        <AvatarFallback className="gradient-primary text-white text-xs">
                                                            {ann.sender?.full_name?.[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <h3 className="font-bold text-lg leading-none mb-1">{ann.title}</h3>
                                                        <p className="text-xs text-muted-foreground font-medium">
                                                            Posted by <span className="text-primary">{ann.sender?.full_name}</span> • {format(new Date(ann.created_at), 'MMM d, h:mm a')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {(role === 'admin' || ann.sender_id === user?.id) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                            onClick={() => handleDeleteAnnouncement(ann.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {ann.target_type === 'global' ?
                                                        <Badge variant="outline"><Globe className="h-3 w-3 mr-1" /> Global</Badge> :
                                                        <Badge variant="secondary"><BookOpen className="h-3 w-3 mr-1" /> {ann.subjects?.name}</Badge>
                                                    }
                                                    {ann.priority !== 'normal' && (
                                                        <Badge className={ann.priority === 'urgent' ? 'bg-destructive' : 'bg-warning'}>
                                                            {ann.priority.toUpperCase()}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="text-sm leading-relaxed text-muted-foreground">
                                            {ann.content}
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="messages" className="flex-1 flex flex-col overflow-hidden bg-muted/20 rounded-2xl border shadow-inner mt-4 p-0">
                        <div className="bg-white/80 backdrop-blur border-b p-3 flex justify-between items-center px-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <MessageSquare className="h-5 w-5 text-primary" />
                                </div>
                                <h2 className="font-bold font-heading">Subject Collaboration</h2>
                            </div>
                            <div className="w-64">
                                <Select value={activeSubject || ''} onValueChange={setActiveSubject}>
                                    <SelectTrigger className="bg-white shadow-sm h-9 border-none">
                                        <SelectValue placeholder="Select Course" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30">
                                    <MessageSquare className="h-16 w-16 mb-4" />
                                    <p className="font-heading text-lg">Start the conversation</p>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div key={msg.id} className={`flex items-start gap-3 ${msg.sender_id === user?.id ? 'flex-row-reverse' : ''}`}>
                                        <Avatar className="h-8 w-8 shrink-0">
                                            <AvatarFallback className={msg.sender_id === user?.id ? 'bg-primary text-white' : 'bg-muted'}>
                                                {msg.sender?.full_name?.[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className={`flex flex-col ${msg.sender_id === user?.id ? 'items-end' : ''}`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{msg.sender?.full_name}</span>
                                                <span className="text-[10px] text-muted-foreground">{format(new Date(msg.created_at), 'hh:mm a')}</span>
                                            </div>
                                            <div className={`p-3 rounded-2xl text-sm shadow-sm max-w-md ${msg.sender_id === user?.id
                                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                : 'bg-white text-foreground rounded-tl-none border'
                                                }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 bg-white/80 backdrop-blur border-t px-6">
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <Input
                                    placeholder="Type your message..."
                                    className="flex-1 shadow-inner bg-muted/20 border-none h-11 focus-visible:ring-primary"
                                    value={msgInput}
                                    onChange={e => setMsgInput(e.target.value)}
                                />
                                <Button type="submit" size="icon" className="h-11 w-11 rounded-xl gradient-primary shadow-premium">
                                    <Send className="h-5 w-5" />
                                </Button>
                            </form>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
};

export default Communication;
