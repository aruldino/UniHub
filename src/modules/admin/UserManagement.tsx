import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, UserPlus, Shield, Loader2, Edit2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { AppRole } from '@/types';

const UserManagement = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isAddingUser, setIsAddingUser] = useState(false);

    // Form State
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'student' as AppRole,
        deptId: 'none',
        batch: '',
        status: 'active'
    });

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editUser, setEditUser] = useState<any>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editSubjects, setEditSubjects] = useState<string[]>([]); // Track selected IDs
    const { toast } = useToast();
    const { role, user } = useAuth(); // ADDED useAuth to get user's role and id

    const fetchData = async () => {
        setLoading(true);
        try {
            console.log('Fetching fresh management data...');
            const { data: profiles, error: pError } = await (supabase.from('profiles').select('id, user_id, full_name, email, avatar_url, is_active, created_at, updated_at, department_id, batch, status').order('full_name') as any);
            const { data: roles, error: rError } = await (supabase.from('user_roles').select('id, user_id, role') as any);
            const { data: depts, error: dError } = await (supabase.from('departments' as any).select('*') as any);
            const { data: subs, error: sError } = await (supabase.from('subjects').select('id, name, code, lecturer_id') as any);

            if (pError || rError || dError || sError) throw pError || rError || dError || sError;

            setDepartments(depts || []);
            setSubjects(subs || []);

            let combined = profiles.map((p: any) => {
                const userRole = roles?.find((r: any) => r.user_id === p.user_id)?.role || 'student';
                return {
                    ...p,
                    role: userRole,
                    dept_name: depts?.find((d: any) => d.id === p.department_id)?.name || 'N/A',
                    assigned_subjects: subs?.filter((s: any) => s.lecturer_id === p.user_id) || []
                };
            });


            console.log('Processed users:', combined.length);
            setUsers(combined);
        } catch (error: any) {
            toast({ title: 'Fetch failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchData();
    }, [user, role]);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAddingUser(true);
        try {
            const { error } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: {
                    data: {
                        full_name: form.name,
                        role: form.role,
                        department_id: form.deptId !== 'none' ? form.deptId : null,
                        batch: form.batch,
                        status: form.status
                    }
                }
            });

            if (error) throw error;

            toast({ title: 'User Created', description: `Account for ${form.name} is ready.` });
            setDialogOpen(false);
            setForm({ name: '', email: '', password: '', role: 'student', deptId: 'none', batch: '', status: 'active' });

            setTimeout(() => fetchData(), 500);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsAddingUser(false);
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Saving user changes...', editUser);
        try {
            // 1. Update Profile
            const { error: pError } = await (supabase.from('profiles').update({
                full_name: editUser.full_name,
                department_id: editUser.department_id === 'none' ? null : editUser.department_id,
                batch: editUser.batch,
                status: editUser.status
            }).eq('user_id', editUser.user_id) as any);

            if (pError) throw pError;

            // 2. Update Role Table - Clean up old roles first to avoid unique constraint issues
            await (supabase.from('user_roles').delete().eq('user_id', editUser.user_id) as any);

            const { error: rError } = await (supabase.from('user_roles').insert({
                user_id: editUser.user_id,
                role: editUser.role
            }) as any);

            if (rError) throw rError;

            // 3. Update Subject Assignments if Lecturer
            if (editUser.role === 'lecturer') {
                // Clear old assignments (set lecturer_id to null for subjects currently held by this user)
                await (supabase.from('subjects').update({ lecturer_id: null } as any).eq('lecturer_id', editUser.user_id) as any);

                // Add new assignments
                if (editSubjects.length > 0) {
                    await (supabase.from('subjects').update({ lecturer_id: editUser.user_id } as any).in('id', editSubjects) as any);
                }
            }

            toast({ title: 'User Updated', description: 'All changes saved successfully.' });
            setEditDialogOpen(false);

            // Wait for DB consistency before re-fetching
            setTimeout(() => {
                fetchData();
            }, 500);
        } catch (error: any) {
            console.error('Update operation failed:', error);
            toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
        }
    };

    const handleDelete = async (user_id: string) => {
        if (!confirm('Deactivate this user?')) return;
        try {
            const { error } = await (supabase.from('profiles').update({ status: 'inactive', deleted_at: new Date().toISOString() } as any).eq('user_id', user_id) as any);
            if (error) throw error;
            toast({ title: 'User Deactivated' });
            fetchData();
        } catch (error: any) {
            toast({ title: 'Failed', description: error.message, variant: 'destructive' });
        }
    };

    const filtered = users.filter(u => u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-heading">{role === 'admin' ? 'User Management' : 'My Students'}</h1>
                        <p className="text-muted-foreground">{role === 'admin' ? 'Admin-only portal for acount control' : 'View students enrolled in your subjects'}</p>
                    </div>

                    {role === 'admin' && (
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gradient-primary"><UserPlus className="mr-2 h-4 w-4" /> Add User</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[450px]">
                                <DialogHeader>
                                    <DialogTitle>New Academy Member</DialogTitle>
                                    <DialogDescription>Setup roles and departments carefully.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleCreateUser} className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Full Name</Label>
                                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email</Label>
                                            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Password</Label>
                                        <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Role</Label>
                                            <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="student">Student</SelectItem>
                                                    <SelectItem value="lecturer">Lecturer</SelectItem>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Department</Label>
                                            <Select value={form.deptId} onValueChange={(v) => setForm({ ...form, deptId: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">N/A</SelectItem>
                                                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Batch (Students)</Label>
                                            <Input placeholder="e.g. 2024" value={form.batch} onChange={e => setForm({ ...form, batch: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Status</Label>
                                            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">Inactive</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" className="w-full gradient-primary" disabled={isAddingUser}>
                                            {isAddingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Account
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>

                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                </div>

                <Card className="shadow-card overflow-hidden">
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 border-none">
                                    <TableHead className="w-12 pl-4">Avatar</TableHead>
                                    <TableHead>Full Name</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Dept / Faculty</TableHead>
                                    <TableHead>Batch</TableHead>
                                    <TableHead>Subjects</TableHead>
                                    <TableHead>Status</TableHead>
                                    {role === 'admin' && <TableHead className="text-right pr-4">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map(u => (
                                    <TableRow key={u.user_id} className={`group hover:bg-muted/50 transition-colors ${u.status === 'inactive' ? 'opacity-50' : ''}`}>
                                        <TableCell>
                                            <Avatar className="h-8 w-8 border shadow-sm">
                                                <AvatarFallback className="gradient-primary text-[10px] text-white">
                                                    {u.full_name?.slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-sm">{u.full_name}</span>
                                                <span className="text-[10px] text-muted-foreground">{u.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`capitalize text-[10px] font-bold ${u.role === 'admin' ? 'border-primary text-primary bg-primary/5' :
                                                u.role === 'lecturer' ? 'border-blue-500 text-blue-500 bg-blue-50' :
                                                    'border-muted text-muted-foreground'
                                                }`}>
                                                {u.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-medium text-muted-foreground">{u.dept_name}</TableCell>
                                        <TableCell className="text-xs font-mono">{u.batch || '—'}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                {u.role === 'lecturer' ? (
                                                    u.assigned_subjects?.length > 0 ? (
                                                        u.assigned_subjects.map((s: any) => (
                                                            <Badge key={s.id} variant="secondary" className="text-[8px] px-1 h-4 bg-primary/5 text-primary border-none">
                                                                {s.code}
                                                            </Badge>
                                                        ))
                                                    ) : <span className="text-[10px] text-muted-foreground">Unassigned</span>
                                                ) : <span className="text-[10px] text-muted-foreground italic">N/A</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={u.status === 'active' ? 'default' : 'secondary'} className={u.status === 'active' ? 'bg-success text-white' : ''}>
                                                {u.status || 'Active'}
                                            </Badge>
                                        </TableCell>
                                        {role === 'admin' && (
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                                        const userSubs = u.assigned_subjects?.map((s: any) => s.id) || [];
                                                        setEditUser({
                                                            ...u,
                                                            department_id: u.department_id || 'none'
                                                        });
                                                        setEditSubjects(userSubs);
                                                        setEditDialogOpen(true);
                                                    }}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(u.user_id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Edit Dialog */}
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogContent>
                        {editUser && (
                            <form onSubmit={handleEdit} className="space-y-4">
                                <DialogHeader>
                                    <DialogTitle>Edit Profile</DialogTitle>
                                    <DialogDescription>Update the member's academy details and roles.</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Full Name</Label>
                                        <Input value={editUser.full_name} onChange={e => setEditUser({ ...editUser, full_name: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Department</Label>
                                            <Select value={editUser.department_id || 'none'} onValueChange={v => setEditUser({ ...editUser, department_id: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">N/A</SelectItem>
                                                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Batch</Label>
                                            <Input value={editUser.batch || ''} onChange={e => setEditUser({ ...editUser, batch: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Role</Label>
                                            <Select value={editUser.role} onValueChange={v => setEditUser({ ...editUser, role: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="student">Student</SelectItem>
                                                    <SelectItem value="lecturer">Lecturer</SelectItem>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Status</Label>
                                            <Select value={editUser.status} onValueChange={v => setEditUser({ ...editUser, status: v })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">Inactive</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {editUser.role === 'lecturer' && (
                                        <div className="space-y-3 pt-4 border-t">
                                            <Label className="text-xs uppercase font-bold text-primary">Subject Assignment</Label>
                                            <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto p-2 border rounded-lg bg-muted/20">
                                                {subjects.length === 0 ? (
                                                    <p className="text-[10px] text-muted-foreground italic">No subjects available in database</p>
                                                ) : (
                                                    subjects.map(s => (
                                                        <div key={s.id} className="flex items-center justify-between p-2 rounded bg-background border shadow-sm">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold">{s.code}</span>
                                                                <span className="text-[10px] text-muted-foreground">{s.name}</span>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant={editSubjects.includes(s.id) ? "default" : "outline"}
                                                                className={`h-6 text-[9px] ${editSubjects.includes(s.id) ? 'bg-primary' : ''}`}
                                                                onClick={() => {
                                                                    setEditSubjects(prev =>
                                                                        prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                                                    );
                                                                }}
                                                            >
                                                                {editSubjects.includes(s.id) ? 'Assigned' : 'Assign'}
                                                            </Button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                            <p className="text-[9px] text-muted-foreground mt-1 tracking-tight">Lecturers can only manage assessments for assigned subjects.</p>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter><Button type="submit" className="w-full">Update Member</Button></DialogFooter>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
};

export default UserManagement;
