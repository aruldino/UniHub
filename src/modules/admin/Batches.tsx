import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Layers, Loader2, Users, Edit2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const Batches = () => {
    const [batches, setBatches] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newYear, setNewYear] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingBatch, setEditingBatch] = useState<any>(null);
    const { toast } = useToast();

    const fetchBatches = async () => {
        setLoading(true);
        try {
            const { data, error } = await (supabase
                .from('batches' as any)
                .select('*, profiles(count)')
                .order('created_at', { ascending: false }) as any);

            if (error) throw error;
            setBatches(data || []);
        } catch (error: any) {
            console.error('Error fetching batches:', error);
            // If table doesn't exist yet, we'll handle gracefully
            if (error.code === '42P01') {
                toast({
                    title: 'Database Setup Required',
                    description: 'Please run the Batch Schema SQL in Supabase editor first.',
                    variant: 'destructive'
                });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBatches();
    }, []);

    const handleSaveBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);

        // Validate batch name - min 10 characters
        if (newName.length < 10) {
            toast({ title: 'Invalid batch name', description: 'Batch name must be at least 10 characters.', variant: 'destructive' });
            setIsCreating(false);
            return;
        }

        // Validate academic year format - 2024/25
        const yearPattern = /^\d{4}\/\d{2}$/;
        if (!yearPattern.test(newYear)) {
            toast({ title: 'Invalid academic year', description: 'Format should be 2024/25 (4 digits + slash + 2 digits).', variant: 'destructive' });
            setIsCreating(false);
            return;
        }

        // Validate description - min 10 characters if provided
        if (newDesc.length > 0 && newDesc.length < 10) {
            toast({ title: 'Invalid description', description: 'Description must be at least 10 characters.', variant: 'destructive' });
            setIsCreating(false);
            return;
        }

        try {
            const data = {
                name: newName,
                description: newDesc,
                academic_year: newYear
            };

            if (editingBatch) {
                const { error } = await (supabase.from('batches' as any).update(data as any).eq('id', editingBatch.id) as any);
                if (error) throw error;
                toast({ title: 'Batch updated', description: `${newName} has been updated successfully.` });
            } else {
                const { error } = await (supabase.from('batches' as any).insert([data as any] as any) as any);
                if (error) throw error;
                toast({ title: 'Batch created', description: `${newName} has been added successfully.` });
            }

            setDialogOpen(false);
            setEditingBatch(null);
            setNewName('');
            setNewDesc('');
            setNewYear('');
            fetchBatches();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteBatch = async (id: string) => {
        if (!confirm('Are you sure? This will remove the batch. Students associated with this batch will become unassigned.')) return;
        try {
            const { error } = await (supabase.from('batches' as any).delete().eq('id', id) as any);
            if (error) throw error;
            toast({ title: 'Batch deleted' });
            fetchBatches();
        } catch (error: any) {
            toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
        }
    };

    const openEditBatch = (batch: any) => {
        setEditingBatch(batch);
        setNewName(batch.name);
        setNewDesc(batch.description || '');
        setNewYear(batch.academic_year || '');
        setDialogOpen(true);
    };

    const filtered = batches.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.academic_year?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-heading text-foreground">Batch Management</h1>
                        <p className="text-muted-foreground">Oragnize students into academic batches</p>
                    </div>

                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gradient-primary">
                                <Plus className="mr-2 h-4 w-4" /> Add New Batch
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>{editingBatch ? 'Edit Batch' : 'Create New Batch'}</DialogTitle>
                                <DialogDescription>
                                    {editingBatch ? 'Update batch details and academic session.' : 'Define a new student group for the academy.'}
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSaveBatch}>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Batch Name <span className="text-[10px] text-muted-foreground">(min 10 chars)</span></Label>
                                        <Input id="name" placeholder="e.g. Computer Science 2024-A" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50} required />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="year">Academic Year <span className="text-[10px] text-muted-foreground">(2024/25)</span></Label>
                                        <Input id="year" placeholder="e.g. 2024/25" value={newYear} onChange={(e) => setNewYear(e.target.value)} maxLength={7} required />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="desc">Description <span className="text-[10px] text-muted-foreground">(min 10 chars, optional)</span></Label>
                                        <Input id="desc" placeholder="Brief details about this batch" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} maxLength={200} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" className="w-full gradient-primary" disabled={isCreating}>
                                        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers className="mr-2 h-4 w-4" />}
                                        {editingBatch ? 'Update Batch' : 'Create Batch'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search batches..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                </div>

                <Card className="shadow-card">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-8 text-center text-muted-foreground">Loading batches...</div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center py-16 text-center">
                                <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold font-heading">No batches found</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {search ? 'Try a different search' : 'No academic batches created yet'}
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Batch Name</TableHead>
                                        <TableHead>Academic Year</TableHead>
                                        <TableHead>Students</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map(batch => (
                                        <TableRow key={batch.id}>
                                            <TableCell className="font-medium">{batch.name}</TableCell>
                                            <TableCell>{batch.academic_year}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Users className="h-3.5 w-3.5" />
                                                    <span>{batch.profiles?.[0]?.count || 0} enrolled</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${batch.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                                                    {batch.is_active ? 'Active' : 'Archived'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(batch.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBatch(batch)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteBatch(batch.id)}>
                                                        <Trash2 className="h-4 w-4" />
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
            </div>
        </DashboardLayout>
    );
};

export default Batches;
