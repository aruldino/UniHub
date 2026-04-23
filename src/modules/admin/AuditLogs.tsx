import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Shield, History, Search, Filter, Eye,
    FileJson, Database, User, Globe, Loader2,
    ArrowRight, Info
} from 'lucide-react';
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AuditLog } from '@/types';

const AuditLogs = () => {
    const { user, role } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loginHistory, setLoginHistory] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [activeTab, setActiveTab] = useState<'logins' | 'audit'>('logins');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('audit_logs' as any)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100) as any;

            if (error) throw error;
            setLogs(data || []);
        } catch (error: any) {
            toast({ title: 'Fetch failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const fetchLoginHistory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('activity_logs' as any)
                .select('*')
                .eq('action', 'LOGIN')
                .order('created_at', { ascending: false })
                .limit(100) as any;

            if (error) throw error;
            setLoginHistory(data || []);
        } catch (error: any) {
            toast({ title: 'Fetch failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (role === 'admin') {
            if (activeTab === 'logins') {
                fetchLoginHistory();
            } else {
                fetchLogs();
            }
        }
    }, [role, activeTab]);

    const filteredLogs = logs.filter(log =>
        log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const ActionBadge = ({ action }: { action: string }) => {
        const variants: any = {
            INSERT: 'bg-success/10 text-success border-success/20',
            UPDATE: 'bg-warning/10 text-warning border-warning/20',
            DELETE: 'bg-destructive/10 text-destructive border-destructive/20'
        };
        return <Badge variant="outline" className={`${variants[action]} font-bold`}>{action}</Badge>;
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Shield className="h-5 w-5 text-primary" />
                            <h1 className="text-2xl font-bold font-heading">Security Audit Trail</h1>
                        </div>
                        <p className="text-muted-foreground text-sm tracking-tight">System activity logs and user login history.</p>
                    </div>

                    <div className="flex gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Filter by email or table..."
                                className="pl-9 w-64 shadow-premium border-none bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" onClick={() => activeTab === 'logins' ? fetchLoginHistory() : fetchLogs()} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                <div className="flex gap-2 border-b border-border pb-2">
                    <Button
                        variant={activeTab === 'logins' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('logins')}
                        className="rounded-b-none"
                    >
                        <History className="h-4 w-4 mr-2" />
                        Login History
                    </Button>
                    <Button
                        variant={activeTab === 'audit' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('audit')}
                        className="rounded-b-none"
                    >
                        <Database className="h-4 w-4 mr-2" />
                        Audit Logs
                    </Button>
                </div>

                <Card className="shadow-premium border-none overflow-hidden">
                    <CardContent className="p-0">
                        {activeTab === 'logins' ? (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead className="pl-6 w-48">Time</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>IP Address</TableHead>
                                        <TableHead className="text-right pr-6">Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-64 text-center">
                                                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                                            </TableCell>
                                        </TableRow>
                                    ) : loginHistory.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-64 text-center text-muted-foreground">
                                                <History className="h-12 w-12 mx-auto mb-4 opacity-10" />
                                                No login records found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        loginHistory.map((login) => (
                                            <TableRow key={login.id} className="hover:bg-muted/10">
                                                <TableCell className="pl-6 font-mono text-xs">
                                                    {format(new Date(login.created_at), 'MMM d, yyyy HH:mm')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm tracking-tight">
                                                            {login.user_id ? login.user_id.slice(0, 8) + '...' : 'Unknown'}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">{login.entity_type}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                                        {login.entity_type || 'user'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                                        <Globe className="h-3 w-3" />
                                                        {login.ip_address || 'Localhost'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Login Details</DialogTitle>
                                                            </DialogHeader>
                                                            <div className="space-y-2 text-sm">
                                                                <p><span className="text-muted-foreground">User ID:</span> {login.user_id}</p>
                                                                <p><span className="text-muted-foreground">Type:</span> {login.entity_type}</p>
                                                                <p><span className="text-muted-foreground">Time:</span> {format(new Date(login.created_at), 'PPPppp')}</p>
                                                                <p><span className="text-muted-foreground">IP:</span> {login.ip_address || 'Localhost'}</p>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead className="pl-6 w-48">Timestamp</TableHead>
                                        <TableHead>Principal</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Entity</TableHead>
                                        <TableHead>Origin</TableHead>
                                        <TableHead className="text-right pr-6">Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-64 text-center">
                                            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-64 text-center text-muted-foreground">
                                            <Database className="h-12 w-12 mx-auto mb-4 opacity-10" />
                                            No audit records found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <TableRow key={log.id} className="hover:bg-muted/10">
                                            <TableCell className="pl-6 font-mono text-xs">
                                                {log.created_at ? format(new Date(log.created_at), 'MMM d, HH:mm:ss.SSS') : 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm tracking-tight">{log.user_email || 'System'}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase font-black">{log.user_role || 'N/A'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <ActionBadge action={log.action} />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-primary/5 text-primary px-2 py-0.5 rounded text-xs font-bold uppercase">{log.table_name || 'N/A'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                                    <Globe className="h-3 w-3" />
                                                    {log.ip_address || 'Localhost'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                                        <DialogHeader>
                                                            <DialogTitle className="flex items-center gap-2">
                                                                <Info className="h-5 w-5 text-primary" /> Record Change Detail
                                                            </DialogTitle>
                                                            <DialogDescription>
                                                                Complete data snapshot for record {log.record_id || 'N/A'}
                                                            </DialogDescription>
                                                        </DialogHeader>

                                                        <div className="space-y-4 pt-4">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="bg-muted/30 p-4 rounded-xl space-y-2">
                                                                    <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Metadata</p>
                                                                    <div className="space-y-1 text-sm">
                                                                        <p><span className="text-muted-foreground">ID:</span> {log.id || 'N/A'}</p>
                                                                        <p><span className="text-muted-foreground">Table:</span> {log.table_name || 'N/A'}</p>
                                                                        <p><span className="text-muted-foreground">Log Time:</span> {log.created_at ? format(new Date(log.created_at), 'PPPppp') : 'N/A'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="bg-muted/30 p-4 rounded-xl space-y-2">
                                                                    <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Principal Context</p>
                                                                    <div className="space-y-1 text-sm">
                                                                        <p><span className="text-muted-foreground">User:</span> {log.user_email || 'System'}</p>
                                                                        <p><span className="text-muted-foreground">Role:</span> {log.user_role || 'N/A'}</p>
                                                                        <p><span className="text-muted-foreground">IP:</span> {log.ip_address || 'Localhost'}</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {log.action === 'INSERT' && (
                                                                <div className="space-y-2">
                                                                    <p className="text-xs font-bold flex items-center gap-2"><ArrowRight className="h-3 w-3 text-success" /> Initial Record Value</p>
                                                                    <pre className="p-4 bg-slate-950 text-emerald-400 rounded-xl overflow-x-auto text-xs font-mono border border-emerald-900/30">
                                                                        {JSON.stringify(log.new_data, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            )}

                                                            {log.action === 'UPDATE' && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div className="space-y-2">
                                                                        <p className="text-xs font-bold text-muted-foreground">Pre-Change (Old)</p>
                                                                        <pre className="p-4 bg-slate-950 text-slate-400 rounded-xl overflow-x-auto text-xs font-mono border">
                                                                            {JSON.stringify(log.old_data, null, 2)}
                                                                        </pre>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <p className="text-xs font-bold text-success-foreground">Post-Change (New)</p>
                                                                        <pre className="p-4 bg-slate-950 text-emerald-400 rounded-xl overflow-x-auto text-xs font-mono border border-emerald-900/30">
                                                                            {JSON.stringify(log.new_data, null, 2)}
                                                                        </pre>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {log.action === 'DELETE' && (
                                                                <div className="space-y-2">
                                                                    <p className="text-xs font-bold text-destructive">Destroyed Data Snapshot</p>
                                                                    <pre className="p-4 bg-slate-950 text-destructive/70 rounded-xl overflow-x-auto text-xs font-mono border border-destructive/30">
                                                                        {JSON.stringify(log.old_data, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default AuditLogs;
