import { useState, useEffect } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
    Loader2, User, Mail, Shield, Building2, Layers, 
    Save, Phone, MapPin, Sparkles, BookOpen, Clock, Camera, Edit2
} from 'lucide-react';

const Profile = () => {
    const { user, profile, role, fetchProfile } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [bio, setBio] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [initialForm, setInitialForm] = useState({
        fullName: '',
        email: '',
        bio: '',
        phone: '',
        address: ''
    });
    const [deptName, setDeptName] = useState('N/A');
    const [subjects, setSubjects] = useState<any[]>([]);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    useEffect(() => {
        if (profile) {
            const next = {
                fullName: profile.full_name || '',
                email: profile.email || '',
                bio: (profile as any).bio || '',
                phone: (profile as any).phone || '',
                address: (profile as any).address || '',
            };
            setFullName(next.fullName);
            setEmail(next.email);
            setBio(next.bio);
            setPhone(next.phone);
            setAddress(next.address);
            setInitialForm(next);
            setIsEditing(false);
            setAvatarFile(null);
            if (avatarPreview) {
                URL.revokeObjectURL(avatarPreview);
                setAvatarPreview(null);
            }
            if (role !== 'admin') fetchDepartment();
            fetchRelevantData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, role]);

    const fetchDepartment = async () => {
        if (role === 'admin') return;
        if (profile?.department_id) {
            const { data } = await supabase
                .from('departments' as any)
                .select('name')
                .eq('id', profile.department_id)
                .maybeSingle();
            if (data) setDeptName((data as any).name);
        }
    };

    useEffect(() => {
        return () => {
            if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        };
    }, [avatarPreview]);

    const uploadAvatarIfNeeded = async () => {
        if (!avatarFile || !user?.id) return null;

        const allowed = ['image/png', 'image/jpeg', 'image/webp'];
        if (!allowed.includes(avatarFile.type)) {
            throw new Error('Only PNG, JPG, or WEBP images are allowed.');
        }
        if (avatarFile.size > 3 * 1024 * 1024) {
            throw new Error('Image too large. Max size is 3MB.');
        }

        const fileExt = avatarFile.name.split('.').pop() || 'png';
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const bucketsToTry = ['avatars', 'assignments'];
        let uploadedBucket: string | null = null;
        let lastError: any = null;

        for (const bucket of bucketsToTry) {
            const { error } = await supabase.storage.from(bucket).upload(filePath, avatarFile, { upsert: true });
            if (!error) {
                uploadedBucket = bucket;
                break;
            }
            lastError = error;
        }

        if (!uploadedBucket) {
            throw new Error(lastError?.message || 'Failed to upload profile image.');
        }

        const { data } = supabase.storage.from(uploadedBucket).getPublicUrl(filePath);
        return data?.publicUrl || null;
    };

    const fetchRelevantData = async () => {
        if (!user) return;
        try {
            if (role === 'student') {
                const { data } = await supabase
                    .from('enrollments' as any)
                    .select('subject_id, subjects(name, code)')
                    .eq('student_id', user.id) as any;
                setSubjects(data?.map((d: any) => d.subjects) || []);
            } else if (role === 'lecturer') {
                const { data } = await supabase
                    .from('subjects' as any)
                    .select('name, code')
                    .eq('lecturer_id', user.id);
                setSubjects(data || []);
            }
        } catch (error) {
            console.error('Fetch subjects error:', error);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEditing) return;
        setLoading(true);

        try {
            const normalizedPhone = phone.replace(/\D/g, '');
            if (normalizedPhone.length > 0 && !/^\d{10}$/.test(normalizedPhone)) {
                toast({
                    title: 'Invalid phone number',
                    description: 'Phone number must be exactly 10 digits (numbers only).',
                    variant: 'destructive'
                });
                return;
            }

            const avatarUrl = await uploadAvatarIfNeeded();
            const updates: any = {
                full_name: fullName,
                bio,
                phone: normalizedPhone,
                address,
                ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
                updated_at: new Date().toISOString(),
            };

            if (role === 'admin') updates.email = email;

            const { error } = await supabase.from('profiles').update(updates).eq('user_id', user?.id);
            if (error) throw error;

            toast({ title: 'Profile Updated', description: 'Your changes have been saved.' });
            setTimeout(async () => { await fetchProfile(); }, 500);
            setAvatarFile(null);
            if (avatarPreview) {
                URL.revokeObjectURL(avatarPreview);
                setAvatarPreview(null);
            }
            setIsEditing(false);
        } catch (error: any) {
            toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const isEmailDisabled = role !== 'admin' || !isEditing;

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-16">
                {/* Premium Profile Header */}
                <div className="relative group">
                    <div className="h-64 rounded-[2.5rem] bg-gradient-to-br from-[#2baec1] via-[#2e406a] to-[#2baec1] bg-[length:200%_auto] animate-gradient overflow-hidden relative shadow-2xl">
                        <div className="absolute inset-0 opacity-20 bg-grid-white"></div>
                        <div className="absolute -top-24 -right-24 h-64 w-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                        <div className="absolute -bottom-24 -left-24 h-64 w-64 bg-black/10 rounded-full blur-3xl" style={{ animationDelay: '1s' }}></div>
                        
                        <div className="absolute bottom-8 right-8 flex gap-2">
                             <Badge className="bg-white/10 backdrop-blur-md border-white/20 text-white font-black tracking-widest uppercase py-1.5 px-4 rounded-full">
                                <Sparkles className="h-3.5 w-3.5 mr-2 text-yellow-300" />
                                {role} 
                             </Badge>
                        </div>
                    </div>

                    <div className="px-8 -mt-20 relative z-10 flex flex-col md:flex-row md:items-end gap-6">
                        <div className="h-40 w-40 rounded-[2rem] bg-white p-2 shadow-2xl border-4 border-white inline-block hover:scale-[1.02] transition-transform duration-500">
                            <div className="h-full w-full rounded-[1.5rem] bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden relative shadow-inner">
                                {avatarPreview || (profile as any)?.avatar_url ? (
                                    <img
                                        src={(avatarPreview || (profile as any)?.avatar_url) as string}
                                        alt="Profile"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-primary text-5xl font-black">
                                        {profile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                    </div>
                                )}

                                <label className="absolute bottom-2 right-2 inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-white/90 backdrop-blur border border-slate-200 shadow-lg cursor-pointer hover:bg-white transition-colors">
                                    <Camera className="h-5 w-5 text-slate-700" />
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className="hidden"
                                        onClick={(e) => {
                                            if (!isEditing) {
                                                e.preventDefault();
                                                toast({ title: 'Edit Mode Required', description: 'Press the Edit button to change your profile picture.' });
                                            }
                                        }}
                                        onChange={(e) => {
                                            if (!isEditing) return;
                                            const f = e.target.files?.[0] || null;
                                            if (!f) return;
                                            if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                                            setAvatarFile(f);
                                            setAvatarPreview(URL.createObjectURL(f));
                                        }}
                                    />
                                </label>
                            </div>
                        </div>
                        <div className="mb-4 space-y-1">
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight font-heading text-slate-900 group-hover:translate-x-1 transition-transform">
                                {profile?.full_name}
                            </h1>
                            <div className="flex flex-wrap items-center gap-4 text-slate-500 font-medium">
                                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {profile?.email}</span>
                                {role !== 'admin' && (
                                    <>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                        <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {deptName}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
                    {/* Sidebar Stats & Info */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <StatCard title="Subjects" value={subjects.length} icon={BookOpen} color="text-[#2baec1]" />
                            <StatCard title="Activity" value="High" icon={Clock} color="text-[#2e406a]" />
                        </div>

                        <Card className="shadow-premium border-none bg-white/50 backdrop-blur-md overflow-hidden rounded-[2rem]">
                            <CardHeader className="border-b border-slate-100 pb-4">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-primary" />
                                    Dossier Info
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <InfoRow label="Institute" value="Northern UNI" />
                                <InfoRow label="Campus" value="Jaffna" />
                                <InfoRow label="Batch" value={(profile as any)?.batch || 'General'} />
                                <InfoRow label="Joined" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'} />
                            </CardContent>
                        </Card>

                        {subjects.length > 0 && (
                            <Card className="shadow-premium border-none rounded-[2rem] overflow-hidden">
                                <CardHeader className="bg-gradient-to-r from-primary to-primary-dark text-white py-4">
                                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                        <BookOpen className="h-4 w-4" />
                                        {role === 'student' ? 'Current Enrollments' : 'Instructional Load'}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-64">
                                        <div className="p-2 space-y-1">
                                            {subjects.map((s, i) => (
                                                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors group/item">
                                                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-primary font-black text-xs group-hover/item:scale-110 transition-transform">
                                                        {s.code.slice(0, 2)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-800">{s.name}</span>
                                                        <span className="text-[10px] text-slate-500 font-mono font-bold">{s.code}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Main Settings Form */}
                    <div className="lg:col-span-2 space-y-8">
                        <Card className="shadow-premium border-none rounded-[2.5rem] bg-white/80 backdrop-blur-sm shadow-xl overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-6">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-2xl font-black font-heading tracking-tight text-slate-900">Information Management</CardTitle>
                                        <CardDescription className="text-slate-500">
                                            {isEditing ? 'Edit your profile details and save changes.' : 'View your profile details. Click Edit to modify.'}
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!isEditing ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="rounded-2xl"
                                                onClick={() => setIsEditing(true)}
                                            >
                                                <Edit2 className="mr-2 h-4 w-4" />
                                                Edit
                                            </Button>
                                        ) : (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="rounded-2xl"
                                                    onClick={() => {
                                                        setFullName(initialForm.fullName);
                                                        setEmail(initialForm.email);
                                                        setBio(initialForm.bio);
                                                        setPhone(initialForm.phone);
                                                        setAddress(initialForm.address);
                                                        setAvatarFile(null);
                                                        if (avatarPreview) {
                                                            URL.revokeObjectURL(avatarPreview);
                                                            setAvatarPreview(null);
                                                        }
                                                        setIsEditing(false);
                                                    }}
                                                    disabled={loading}
                                                >
                                                    Cancel
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8">
                                <form onSubmit={handleUpdateProfile} className="space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <ProfileInput 
                                            label="Formal Name" 
                                            icon={User} 
                                            value={fullName} 
                                            onChange={(e: any) => setFullName(e.target.value)} 
                                            required 
                                            disabled={!isEditing}
                                        />
                                        <ProfileInput 
                                            label="Digital Identity (Email)" 
                                            icon={Mail} 
                                            value={email} 
                                            onChange={(e: any) => setEmail(e.target.value)} 
                                            disabled={isEmailDisabled} 
                                        />
                                        <ProfileInput 
                                            label="Communication Link (Phone)" 
                                            icon={Phone} 
                                            value={phone} 
                                            onChange={(e: any) => {
                                                const digits = String(e.target.value || '').replace(/\D/g, '').slice(0, 10);
                                                setPhone(digits);
                                            }} 
                                            placeholder="10-digit phone number"
                                            disabled={!isEditing}
                                        />
                                        <ProfileInput 
                                            label="Physical Residency" 
                                            icon={MapPin} 
                                            value={address} 
                                            onChange={(e: any) => setAddress(e.target.value)} 
                                            placeholder="City, Country"
                                            disabled={!isEditing}
                                        />
                                        
                                        <div className="md:col-span-2 space-y-3">
                                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Professional Abstract (Bio)</Label>
                                            <textarea
                                                className={`w-full min-h-[120px] p-5 bg-slate-50/50 border-2 border-slate-100 rounded-3xl text-sm font-medium outline-none transition-all placeholder:text-slate-400 shadow-inner ${isEditing ? 'focus:ring-4 ring-primary/10 border-primary/20' : 'opacity-80 cursor-not-allowed'}`}
                                                placeholder="A brief summary about your academic or professional background..."
                                                value={bio}
                                                onChange={(e) => setBio(e.target.value)}
                                                readOnly={!isEditing}
                                            />
                                        </div>
                                    </div>

                                    {isEditing && (
                                        <div className="flex justify-end pt-6">
                                            <Button type="submit" className="gradient-primary px-12 h-14 font-black rounded-2xl shadow-xl shadow-[#2baec1]/20 hover:-translate-y-1 transition-all" disabled={loading}>
                                                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                                                Commit Changes
                                            </Button>
                                        </div>
                                    )}
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="shadow-premium border-none rounded-[2.5rem] bg-white/80 backdrop-blur-sm overflow-hidden shadow-xl relative">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
                            <CardHeader className="px-8 py-6 border-b border-slate-100 relative z-10">
                                <CardTitle className="text-2xl font-black font-heading tracking-tight text-slate-900">Access Protocol</CardTitle>
                                <CardDescription className="text-slate-500">Secure your digital campus account</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 relative z-10">
                                <ChangePasswordForm />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <Card className="shadow-premium border-none rounded-3xl overflow-hidden hover:-translate-y-1 transition-all duration-300">
        <CardContent className="p-6">
            <div className="flex flex-col items-center gap-3">
                <div className={`p-3 rounded-2xl bg-slate-50 ${color} group-hover:scale-110 transition-transform`}>
                    <Icon className="h-6 w-6" />
                </div>
                <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">{title}</p>
                    <h4 className="text-2xl font-black text-slate-900">{value}</h4>
                </div>
            </div>
        </CardContent>
    </Card>
);

const InfoRow = ({ label, value }: { label: string, value: string }) => (
    <div className="flex justify-between items-center group">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">{label}</span>
        <span className="text-sm font-black text-slate-700 font-heading">{value}</span>
    </div>
);

const ProfileInput = ({ label, icon: Icon, ...props }: any) => (
    <div className="space-y-3">
        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">{label}</Label>
        <div className="relative group">
            <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input 
                {...props} 
                className={`pl-12 h-14 bg-slate-50/50 border-2 border-slate-100 rounded-2xl font-bold focus:bg-white focus:ring-4 ring-primary/10 border-primary/20 transition-all ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}`} 
            />
        </div>
    </div>
);

const ChangePasswordForm = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return toast({ title: 'Passwords do not match', variant: 'destructive' });
        }
        if (password.length < 6) {
            return toast({ title: 'Password too short', description: 'Minimum 6 characters required.', variant: 'destructive' });
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            toast({ title: 'Success', description: 'Your password has been updated.' });
            setPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handlePasswordChange} className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">New Vault Key</Label>
                    <Input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                        className="h-14 bg-slate-50/50 border-slate-100 rounded-2xl border-2 focus:border-primary transition-all text-slate-900 font-black"
                    />
                </div>
                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Verify Vault Key</Label>
                    <Input 
                        type="password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        required 
                        className="h-14 bg-slate-50/50 border-slate-100 rounded-2xl border-2 focus:border-primary transition-all text-slate-900 font-black"
                    />
                </div>
            </div>
            <div className="flex justify-end pt-4">
                <Button type="submit" className="gradient-primary px-10 h-14 font-black rounded-2xl transition-all shadow-xl shadow-[#2baec1]/20 hover:-translate-y-1" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    Update Access
                </Button>
            </div>
        </form>
    );
};

export default Profile;
