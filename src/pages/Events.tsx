import { useEffect, useState } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar, MapPin, Tag, Plus, Loader2, Search,
  Filter, Edit2, Trash2, Clock, Image as ImageIcon
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const CATEGORIES = ['General', 'Academic', 'Sports', 'Cultural', 'Workshop', 'Career'];

const Events = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_date: '',
    location: '',
    category: 'General',
    image_url: '',
    is_published: true
  });

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let query = supabase.from('events' as any).select('*').order('event_date', { ascending: true });

      if (role !== 'admin') {
        query = query.eq('is_published', true);
      }

      const { data, error } = await (query as any);
      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      toast({ title: 'Fetch failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [role]);

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      const eventData = {
        title: form.title,
        description: form.description,
        event_date: new Date(form.event_date).toISOString(),
        location: form.location,
        category: form.category,
        image_url: form.image_url,
        is_published: form.is_published,
        created_by: user?.id
      };

      if (editingEvent) {
        const { error } = await (supabase.from('events' as any).update(eventData as any).eq('id', editingEvent.id) as any);
        if (error) throw error;
        toast({ title: 'Success', description: 'Event updated successfully.' });
      } else {
        const { error } = await (supabase.from('events' as any).insert([eventData as any] as any) as any);
        if (error) throw error;
        toast({ title: 'Success', description: 'Event scheduled successfully.' });
      }

      setIsCreateOpen(false);
      setEditingEvent(null);
      setForm({ title: '', description: '', event_date: '', location: '', category: 'General', image_url: '', is_published: true });
      fetchEvents();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      const { error } = await (supabase.from('events' as any).delete().eq('id', id) as any);
      if (error) throw error;
      toast({ title: 'Event deleted' });
      fetchEvents();
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    }
  };

  const openEditEvent = (event: any) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description || '',
      event_date: event.event_date.slice(0, 16),
      location: event.location || '',
      category: event.category || 'General',
      image_url: event.image_url || '',
      is_published: event.is_published
    });
    setIsCreateOpen(true);
  };

  const filtered = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.location?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Campus Events</h1>
            <p className="text-muted-foreground">Stay updated with activities, workshops, and gatherings</p>
          </div>

          {role === 'admin' && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary">
                  <Plus className="mr-2 h-4 w-4" /> Schedule Event
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingEvent ? 'Edit Event' : 'New Campus Event'}</DialogTitle>
                  <DialogDescription>Fill in the details for the campus event.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveEvent} className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Event Title</Label>
                    <Input
                      placeholder="e.g. Annual Sports Meet"
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="What's happening?"
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={form.event_date}
                        onChange={e => setForm({ ...form, event_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-10"
                        placeholder="e.g. Main Auditorium"
                        value={form.location}
                        onChange={e => setForm({ ...form, location: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Banner Image URL (Optional)</Label>
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-10"
                        placeholder="https://..."
                        value={form.image_url}
                        onChange={e => setForm({ ...form, image_url: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full gradient-primary" disabled={isActionLoading}>
                      {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingEvent ? 'Update Event' : 'Publish Event'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Find events by title or location..."
              className="pl-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="bg-card">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Category" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed border-2 py-20 text-center text-muted-foreground bg-muted/5">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-10" />
            <p className="font-medium">No events found matching your criteria.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((event) => (
              <Card key={event.id} className="shadow-premium border-none overflow-hidden group transition-all hover:-translate-y-1 hover:shadow-2xl">
                {event.image_url ? (
                  <div className="h-48 w-full overflow-hidden relative">
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    <div className="absolute top-3 left-3">
                      <Badge className="backdrop-blur-md bg-black/40 border-none">{event.category}</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="h-40 w-full gradient-primary flex items-center justify-center relative">
                    <Calendar className="h-16 w-16 text-white/20" />
                    <div className="absolute top-3 left-3">
                      <Badge className="backdrop-blur-md bg-white/20 border-none text-white">{event.category}</Badge>
                    </div>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl font-heading leading-tight">{event.title}</CardTitle>
                    {role === 'admin' && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEvent(event)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteEvent(event.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <CardDescription className="line-clamp-2 mt-2">{event.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Clock className="h-4 w-4" />
                      </div>
                      <span>{format(new Date(event.event_date), 'EEEE, MMM do · HH:mm')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <span className="truncate">{event.location}</span>
                    </div>
                  </div>
                  <Button className="w-full bg-accent hover:bg-accent/80 text-accent-foreground font-bold shadow-none" variant="secondary">
                    Interested
                  </Button>
                </CardContent>
                {!event.is_published && (
                  <div className="absolute top-0 right-0 p-2">
                    <Badge variant="destructive" className="text-[10px] uppercase font-bold">Draft</Badge>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Events;
