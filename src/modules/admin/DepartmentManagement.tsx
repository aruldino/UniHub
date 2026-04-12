import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Loader2, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const DEPT_NAME_MIN = 10;
const DEPT_DESC_MIN = 10;
/** Letters (including Unicode), spaces, hyphen, apostrophe — no digits. */
const DEPT_NAME_PATTERN = /^[\p{L}\s''\-]+$/u;

function validateDepartmentFields(name: string, description: string): string | null {
    const n = name.trim();
    const d = description.trim();
    if (n.length < DEPT_NAME_MIN) {
        return `Department name must be at least ${DEPT_NAME_MIN} characters.`;
    }
    if (/\d/.test(n)) {
        return 'Department name cannot contain numbers.';
    }
    if (!DEPT_NAME_PATTERN.test(n)) {
        return 'Department name may only contain letters, spaces, hyphens, and apostrophes.';
    }
    if (d.length < DEPT_DESC_MIN) {
        return `Description must be at least ${DEPT_DESC_MIN} characters.`;
    }
    return null;
}

const DepartmentManagement = () => {
    const [departments, setDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newDeptName, setNewDeptName] = useState('');
    const [newDeptDesc, setNewDeptDesc] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editDept, setEditDept] = useState<any>(null);
    const { toast } = useToast();

    const fetchDepartments = async () => {
        setLoading(true);
        try {
            const { data, error } = await (supabase.from('departments' as any).select('*').order('name') as any);
            if (error) throw error;
            setDepartments(data || []);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    const handleAddDept = async (e: React.FormEvent) => {
        e.preventDefault();
        const err = validateDepartmentFields(newDeptName, newDeptDesc);
        if (err) {
            toast({ title: 'Invalid input', description: err, variant: 'destructive' });
            return;
        }
        setIsAdding(true);
        try {
            const { error } = await (supabase.from('departments' as any).insert([{ name: newDeptName.trim(), description: newDeptDesc.trim() } as any]) as any);
            if (error) throw error;
            toast({ title: 'Success', description: 'Department created.' });
            setDialogOpen(false);
            setNewDeptName('');
            setNewDeptDesc('');
            fetchDepartments();
        } catch (error: any) {
            const msg = String(error?.message ?? '');
            const desc = msg.includes('row-level security')
                ? 'Only an administrator can create departments. If you are an admin, apply pending Supabase migrations (departments RLS) or ask your database admin.'
                : msg;
            toast({ title: 'Failed', description: desc, variant: 'destructive' });
        } finally {
            setIsAdding(false);
        }
    };

    const handleEditDept = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editDept) return;
        const err = validateDepartmentFields(editDept.name, editDept.description ?? '');
        if (err) {
            toast({ title: 'Invalid input', description: err, variant: 'destructive' });
            return;
        }
        setIsUpdating(true);
        try {
            const { error } = await supabase.from('departments' as any).update({
                name: editDept.name.trim(),
                description: (editDept.description ?? '').trim()
            }).eq('id', editDept.id);
            if (error) throw error;
            toast({ title: 'Success', description: 'Department updated.' });
            setEditDialogOpen(false);
            fetchDepartments();
        } catch (error: any) {
            const msg = String(error?.message ?? '');
            const desc = msg.includes('row-level security')
                ? 'Only an administrator can update departments. Apply pending Supabase migrations if this persists.'
                : msg;
            toast({ title: 'Failed', description: desc, variant: 'destructive' });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? This may affect users linked to this department.')) return;
        try {
            const { error } = await (supabase.from('departments' as any).delete().eq('id', id) as any);
            if (error) throw error;
            toast({ title: 'Deleted', description: 'Department removed.' });
            fetchDepartments();
        } catch (error: any) {
            const msg = String(error?.message ?? '');
            const desc = msg.includes('row-level security')
                ? 'Only an administrator can delete departments. Apply pending Supabase migrations if this persists.'
                : msg;
            toast({ title: 'Delete failed', description: desc, variant: 'destructive' });
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold font-heading">Departments</h1>
                        <p className="text-muted-foreground">Manage academy faculty and departments</p>
                    </div>
                    <Dialog
                        open={dialogOpen}
                        onOpenChange={(open) => {
                            setDialogOpen(open);
                            if (!open) {
                                setNewDeptName('');
                                setNewDeptDesc('');
                            }
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button className="gradient-primary">
                                <Plus className="mr-2 h-4 w-4" /> Add Department
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Department</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAddDept} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>
                                        Department Name{' '}
                                        <span className="text-[10px] font-normal text-muted-foreground">
                                            (letters only, no numbers, min {DEPT_NAME_MIN} characters)
                                        </span>
                                    </Label>
                                    <Input
                                        value={newDeptName}
                                        onChange={(e) => setNewDeptName(e.target.value.replace(/[0-9]/g, ''))}
                                        placeholder="e.g. Computer Science"
                                        minLength={DEPT_NAME_MIN}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>
                                        Description{' '}
                                        <span className="text-[10px] font-normal text-muted-foreground">(min {DEPT_DESC_MIN} characters)</span>
                                    </Label>
                                    <Textarea
                                        value={newDeptDesc}
                                        onChange={(e) => setNewDeptDesc(e.target.value)}
                                        placeholder="e.g. Faculty of Information Technology"
                                        minLength={DEPT_DESC_MIN}
                                        rows={3}
                                        className="resize-y min-h-[72px]"
                                        required
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isAdding}>
                                        {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Create Department
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>No.</TableHead>
                                        <TableHead>Department Name</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {departments.map((dept, idx) => (
                                        <TableRow key={dept.id}>
                                            <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                                            <TableCell className="font-semibold">{dept.name}</TableCell>
                                            <TableCell>{dept.description}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => { setEditDept(dept); setEditDialogOpen(true); }}>
                                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(dept.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Edit Dialog */}
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Update Department</DialogTitle>
                        </DialogHeader>
                        {editDept && (
                            <form onSubmit={handleEditDept} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>
                                        Department Name{' '}
                                        <span className="text-[10px] font-normal text-muted-foreground">
                                            (letters only, no numbers, min {DEPT_NAME_MIN} characters)
                                        </span>
                                    </Label>
                                    <Input
                                        value={editDept.name}
                                        onChange={(e) => setEditDept({ ...editDept, name: e.target.value.replace(/[0-9]/g, '') })}
                                        minLength={DEPT_NAME_MIN}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>
                                        Description{' '}
                                        <span className="text-[10px] font-normal text-muted-foreground">(min {DEPT_DESC_MIN} characters)</span>
                                    </Label>
                                    <Textarea
                                        value={editDept.description ?? ''}
                                        onChange={(e) => setEditDept({ ...editDept, description: e.target.value })}
                                        minLength={DEPT_DESC_MIN}
                                        rows={3}
                                        className="resize-y min-h-[72px]"
                                        required
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isUpdating}>
                                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Changes
                                    </Button>
                                </DialogFooter>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
};

export default DepartmentManagement;
