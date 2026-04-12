import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    ShieldCheck, Lock, UserCog, Settings2,
    Check, X, Loader2, AlertCircle, Save, Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Permission } from '@/types';
import { useNavigate } from 'react-router-dom';


const PermissionControl = () => {
    const { role } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [roleMappings, setRoleMappings] = useState<any>({
        admin: [],
        lecturer: [],
        student: []
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch all permissions
            const { data: perms } = await supabase.from('permissions' as any).select('*') as any;
            setPermissions((perms || []) as Permission[]);

            // 2. Fetch all mappings
            const { data: mappings } = await supabase.from('role_permissions' as any).select('*');

            const newMappings: any = { admin: [], lecturer: [], student: [] };
            mappings?.forEach((m: any) => {
                newMappings[m.role].push(m.permission_id);
            });
            setRoleMappings(newMappings);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (role === 'admin') fetchData();
    }, [role]);

    const handleToggle = (appRole: string, permissionId: string) => {
        setRoleMappings((prev: any) => {
            const current = prev[appRole];
            const isAssigned = current.includes(permissionId);
            const updated = isAssigned
                ? current.filter((id: string) => id !== permissionId)
                : [...current, permissionId];
            return { ...prev, [appRole]: updated };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // This is a brutal sync strategy: delete all and re-insert
            // In a production app, we'd diff them, but for enterprise agility:
            const { error: delError } = await supabase
                .from('role_permissions' as any)
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (delError) throw delError;

            const newPerms: any[] = [];
            Object.keys(roleMappings).forEach(r => {
                roleMappings[r].forEach((pId: string) => {
                    newPerms.push({ role: r, permission_id: pId });
                });
            });

            const { error: insError } = await supabase
                .from('role_permissions' as any)
                .insert(newPerms);

            if (insError) throw insError;

            toast({ title: 'Permissions Synced', description: 'Updated access control policies successfully.' });
        } catch (error: any) {
            toast({ title: 'Sync Failed', description: error.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleSeed = async () => {
        setLoading(true);
        try {
            const defaults = [
                { name: 'manage:users', description: 'Create, update and delete users', module: 'admin' },
                { name: 'manage:departments', description: 'Manage institutional departments', module: 'admin' },
                { name: 'view:audit_logs', description: 'View system security logs', module: 'admin' },
                { name: 'manage:subjects', description: 'Create and modify course structures', module: 'academic' },
                { name: 'manage:grading', description: 'Enter and modify student results', module: 'academic' },
                { name: 'manage:announcements', description: 'Dispatch academy-wide notices', module: 'communication' },
                { name: 'post:messages', description: 'Participate in subject-level chats', module: 'communication' },
                { name: 'manage:security', description: 'Modify system access matrix', module: 'admin' },
                { name: 'view:reports', description: 'View institutional analytics', module: 'admin' }
            ];

            const { error: pError } = await supabase.from('permissions' as any).insert(defaults);
            if (pError) throw pError;

            // Grant all to admin by default
            const { data: newPerms } = await supabase.from('permissions' as any).select('id') as any;
            if (newPerms) {
                const mappings = newPerms.map(p => ({ role: 'admin', permission_id: p.id }));
                await supabase.from('role_permissions' as any).insert(mappings);
            }

            toast({ title: 'System Seeded', description: 'Default permission matrix has been initialized.' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Seeding Failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const modules = Array.from(new Set(permissions.map(p => p.module)));

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-fade-in pb-20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                            <h1 className="text-2xl font-bold font-heading">Access Matrix Control</h1>
                        </div>
                        <p className="text-muted-foreground text-sm tracking-tight">Define granular permissions for each user role.</p>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => navigate('/admin/users')} className="shadow-sm">
                            <UserCog className="mr-2 h-4 w-4" />
                            User Management
                        </Button>
                        <Button onClick={handleSave} disabled={saving || permissions.length === 0} className="gradient-primary shadow-premium">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Apply Changes
                        </Button>
                    </div>
                </div>

                <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-start gap-4 mb-6">
                    <div className="bg-primary/10 p-2 rounded-xl">
                        <Info className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-primary">How Access Works</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                            Individual accounts are given permissions by assigning them a <strong>Role</strong> (Admin, Lecturer, or Student).
                            Use the matrix below to define what each Role is allowed to do. To change a specific person's access, go to the
                            <button onClick={() => navigate('/admin/users')} className="text-primary font-bold hover:underline mx-1">Users</button>
                            page and change their Role.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="h-96 flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary/30" />
                        <p className="text-sm text-muted-foreground animate-pulse">Scanning security matrix...</p>
                    </div>
                ) : permissions.length === 0 ? (
                    <div className="h-96 flex flex-col items-center justify-center text-center space-y-6 rounded-3xl border-2 border-dashed bg-muted/20 p-8">
                        <div className="bg-white p-6 rounded-full shadow-premium">
                            <Lock className="h-12 w-12 text-primary animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">No Permissions Seeded</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto text-sm mt-2 leading-relaxed">
                                Your security table is empty. You can either run the SQL setup script or click below to initialize the default system capabilities.
                            </p>
                        </div>
                        <Button onClick={handleSeed} className="gradient-primary px-8 shadow-xl hover:scale-105 transition-transform">
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Seed Default Matrix
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {modules.map(module => (
                            <Card key={module} className="shadow-premium border-none overflow-hidden">
                                <CardHeader className="bg-muted/30">
                                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                        <Settings2 className="h-4 w-4 text-primary" /> {module} Module
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b bg-muted/10">
                                                    <th className="p-4 font-bold text-sm">Capability</th>
                                                    <th className="p-4 text-center w-32 font-bold text-sm">Admin</th>
                                                    <th className="p-4 text-center w-32 font-bold text-sm">Lecturer</th>
                                                    <th className="p-4 text-center w-32 font-bold text-sm">Student</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {permissions.filter(p => p.module === module).map(p => (
                                                    <tr key={p.id} className="border-b hover:bg-muted/5 transition-colors">
                                                        <td className="p-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm text-foreground">{p.name}</span>
                                                                <span className="text-xs text-muted-foreground">{p.description}</span>
                                                            </div>
                                                        </td>
                                                        {['admin', 'lecturer', 'student'].map(r => (
                                                            <td key={r} className="p-4 text-center">
                                                                <Checkbox
                                                                    checked={roleMappings[r].includes(p.id)}
                                                                    onCheckedChange={() => handleToggle(r, p.id)}
                                                                    disabled={r === 'admin'} // Admin always has full perms
                                                                    className="h-5 w-5 rounded-md border-primary/20 data-[state=checked]:bg-primary"
                                                                />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default PermissionControl;
