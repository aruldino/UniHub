import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    LogIn, LogOut, Users, Shield, AlertCircle, CheckCircle, Clock,
    Calendar, Search, Filter, Download, RefreshCw, Eye, XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LoginSession {
    id: string;
    user_id: string;
    action: string;
    entity_type: string;
    created_at: string;
    profiles?: {
        full_name: string;
        email: string;
    };
}

interface SystemError {
    id: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
    resolved: boolean;
}

const SystemAdmin = () => {
    const [loginSessions, setLoginSessions] = useState<LoginSession[]>([]);
    const [systemErrors, setSystemErrors] = useState<SystemError[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState('all');
    const [showErrorPopup, setShowErrorPopup] = useState(false);
    const [activeErrors, setActiveErrors] = useState<SystemError[]>([]);
    const { toast } = useToast();

    const fetchLoginSessions = async () => {
        try {
            const { data, error } = await (supabase.from('activity_logs') as any)
                .select('id, user_id, action, entity_type, created_at')
                .eq('action', 'LOGIN')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setLoginSessions(data || []);
        } catch (error: any) {
            handleError('Failed to fetch login sessions', error);
        }
    };

    const fetchSystemErrors = async () => {
        try {
            const { data, error } = await (supabase.from('system_errors') as any)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setSystemErrors(data || []);

            // Show popup for new unresolved errors
            const unresolved = (data || []).filter((e: any) => !e.resolved);
            if (unresolved.length > 0) {
                setActiveErrors(unresolved);
                setShowErrorPopup(true);
            }
        } catch (error: any) {
            console.error('Error fetching system errors:', error);
        }
    };

    const handleError = (message: string, error?: any) => {
        console.error(message, error);
        toast({
            title: 'System Error',
            description: message,
            variant: 'destructive',
        });

        // Add to error popup
        const newError: SystemError = {
            id: Date.now().toString(),
            message,
            severity: 'high',
            timestamp: new Date().toISOString(),
            resolved: false
        };
        setActiveErrors(prev => [newError, ...prev]);
        setShowErrorPopup(true);
    };

    useEffect(() => {
        fetchLoginSessions();
        fetchSystemErrors();

        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            fetchLoginSessions();
            fetchSystemErrors();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const filteredSessions = loginSessions.filter(session => {
        const matchesSearch = session.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            session.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterAction === 'all' || session.action === filterAction;
        return matchesSearch && matchesFilter;
    });

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-500';
            case 'high': return 'bg-secondary';
            case 'medium': return 'bg-yellow-500';
            case 'low': return 'bg-blue-500';
            default: return 'bg-gray-500';
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'LOGIN': return LogIn;
            case 'LOGOUT': return LogOut;
            default: return Clock;
        }
    };

    return (
        <div className="space-y-6">
            {/* Error Popup Modal */}
            {showErrorPopup && activeErrors.length > 0 && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-red-500/30 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-slide-up">
                        <div className="p-6 border-b border-red-500/20 bg-gradient-to-r from-red-500/10 to-transparent">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-xl bg-red-500 shadow-lg shadow-red-500/50">
                                        <AlertCircle className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">System Errors Detected</h3>
                                        <p className="text-sm text-white/60">{activeErrors.length} unresolved issue(s)</p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowErrorPopup(false)}
                                    className="text-white/60 hover:text-white hover:bg-white/10"
                                >
                                    <XCircle className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                        <div className="p-6 space-y-3 overflow-y-auto max-h-[60vh]">
                            {activeErrors.map((error) => (
                                <div key={error.id} className="flex items-start gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <div className={`h-3 w-3 rounded-full mt-2 ${getSeverityColor(error.severity)} animate-pulse`}></div>
                                    <div className="flex-1">
                                        <p className="text-white font-medium">{error.message}</p>
                                        <p className="text-xs text-white/60 mt-1">
                                            {new Date(error.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setActiveErrors(prev => prev.filter(e => e.id !== error.id));
                                            if (activeErrors.length === 1) setShowErrorPopup(false);
                                        }}
                                        className="border-red-500/30 text-red-400 hover:bg-red-500/20"
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Header with Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-0 shadow-xl bg-gradient-to-br from-[#2baec1]/20 to-slate-800/80 backdrop-blur-xl">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-[#2baec1]">Total Logins</p>
                                <h3 className="text-3xl font-black text-white mt-1">{loginSessions.length}</h3>
                            </div>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-[#2baec1] to-[#2baec1]/60 shadow-lg shadow-[#2baec1]/30">
                                <LogIn className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-xl bg-gradient-to-br from-[#2e406a]/20 to-slate-800/80 backdrop-blur-xl">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-[#2e406a]">Active Users</p>
                                <h3 className="text-3xl font-black text-white mt-1">
                                    {new Set(loginSessions.map(s => s.user_id)).size}
                                </h3>
                            </div>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-[#2e406a] to-[#2e406a]/60 shadow-lg shadow-[#2e406a]/30">
                                <Users className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-xl bg-gradient-to-br from-red-500/20 to-slate-800/80 backdrop-blur-xl">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-red-500">System Errors</p>
                                <h3 className="text-3xl font-black text-white mt-1">{systemErrors.filter(e => !e.resolved).length}</h3>
                            </div>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-red-500 to-red-500/60 shadow-lg shadow-red-500/30">
                                <AlertCircle className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-xl bg-gradient-to-br from-green-500/20 to-slate-800/80 backdrop-blur-xl">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-green-500">System Status</p>
                                <h3 className="text-3xl font-black text-white mt-1">99.9%</h3>
                            </div>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-green-500 to-green-500/60 shadow-lg shadow-green-500/30">
                                <CheckCircle className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Login Sessions Table */}
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#2baec1] via-[#2e406a] to-[#2baec1]"></div>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-[#2baec1] to-[#2baec1]/60 shadow-lg">
                                <Shield className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-lg font-bold">Login Sessions Tracker</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchLoginSessions}
                                className="border-white/20 text-white hover:bg-white/10"
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[#2baec1]/50"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-white/40" />
                            <select
                                value={filterAction}
                                onChange={(e) => setFilterAction(e.target.value)}
                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#2baec1]/50"
                            >
                                <option value="all">All Actions</option>
                                <option value="LOGIN">Logins</option>
                                <option value="LOGOUT">Logouts</option>
                            </select>
                        </div>
                    </div>

                    {/* Sessions List */}
                    <div className="space-y-2">
                        {filteredSessions.length > 0 ? filteredSessions.map((session) => {
                            const ActionIcon = getActionIcon(session.action);
                            return (
                                <div
                                    key={session.id}
                                    className="group flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#2e406a]/30 transition-all duration-300 hover:scale-[1.01]"
                                >
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#2e406a] to-[#2e406a]/60 flex items-center justify-center text-white shadow-lg group-hover:shadow-[#2e406a]/50 transition-shadow">
                                        <ActionIcon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-white">{session.profiles?.full_name || 'Unknown'}</p>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                session.action === 'LOGIN'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-red-500/20 text-red-400'
                                            }`}>
                                                {session.action}
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/60 truncate">{session.profiles?.email || 'N/A'}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-2 text-white/80">
                                            <Clock className="h-3 w-3" />
                                            <span className="text-sm font-medium">
                                                {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/40">
                                            {new Date(session.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-white/40 hover:text-[#2baec1] hover:bg-[#2baec1]/10"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </div>
                            );
                        }) : (
                            <div className="text-center py-12">
                                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-white/5 mb-4">
                                    <Search className="h-8 w-8 text-white/40" />
                                </div>
                                <p className="text-white/60">No login sessions found</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* System Errors Panel */}
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-slate-900/80 to-slate-800/80 backdrop-blur-xl overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary to-primary"></div>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-white">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-red-500/60 shadow-lg">
                            <AlertCircle className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-lg font-bold">System Errors Log</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {systemErrors.length > 0 ? systemErrors.map((error) => (
                            <div
                                key={error.id}
                                className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                                    error.resolved
                                        ? 'bg-green-500/5 border-green-500/20'
                                        : 'bg-red-500/10 border-red-500/20 hover:scale-[1.01]'
                                }`}
                            >
                                <div className={`h-3 w-3 rounded-full ${getSeverityColor(error.severity)} ${!error.resolved && 'animate-pulse'}`}></div>
                                <div className="flex-1">
                                    <p className={`text-sm font-medium ${error.resolved ? 'text-green-400 line-through' : 'text-white'}`}>
                                        {error.message}
                                    </p>
                                    <p className="text-xs text-white/40 mt-1">
                                        {new Date(error.timestamp).toLocaleString()}
                                    </p>
                                </div>
                                {error.resolved ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                                        Unresolved
                                    </span>
                                )}
                            </div>
                        )) : (
                            <div className="text-center py-12">
                                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-500/10 mb-4">
                                    <CheckCircle className="h-8 w-8 text-green-500" />
                                </div>
                                <p className="text-white/60">No system errors recorded</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SystemAdmin;
