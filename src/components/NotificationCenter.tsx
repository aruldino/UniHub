import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Bell, MessageSquare, Check, X, ShieldAlert, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';

const NotificationCenter = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const locationRef = useRef(location.pathname);

    useEffect(() => {
        locationRef.current = location.pathname;
    }, [location.pathname]);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select(`
                    *,
                    actor:profiles!notifications_actor_id_fkey(full_name, avatar_url)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('[NotificationCenter] Fetch Error Details:', error.message, error.details, error.hint);
                return;
            }

            setNotifications(data || []);
            setUnreadCount(data?.filter((n: any) => !n.is_read).length || 0);
        } catch (err: any) {
            console.error('[NotificationCenter] Unexpected Crash:', err);
        }
    };

    useEffect(() => {
        if (!user) return;
        fetchNotifications();

        // Use a unique channel name per user to avoid potential collisions across different network origins
        const channelName = `notifications_${user.id.slice(0, 8)}`;
        console.log(`[NotificationCenter] Subscribing to: ${channelName}`);

        const channel = supabase.channel(channelName)
            .on('postgres_changes', {
                event: '*', // Listen to all changes to keep UI in sync
                table: 'notifications',
                schema: 'public',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                console.log('[NotificationCenter] New Change Received:', payload.eventType);

                // Show pop-up toast only on NEW notifications
                if (payload.eventType === 'INSERT') {
                    const newNotif = payload.new as any;

                    // Supress toast if we are on the social hub and it's a message
                    const currentPath = locationRef.current;
                    const isSocialHub = currentPath.includes('/groups');
                    const shouldSuppress = isSocialHub && (newNotif.type === 'message' || newNotif.type === 'chat_request');

                    if (!shouldSuppress) {
                        toast({
                            title: newNotif.title,
                            description: newNotif.message,
                            className: "bg-primary text-primary-foreground border-none font-bold shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300"
                        });
                    }
                }

                // Refresh list for any event (INSERT, UPDATE, DELETE)
                fetchNotifications();
            })
            .subscribe((status) => {
                console.log(`[NotificationCenter] Subscription Status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log('[NotificationCenter] Successfully connected to Realtime stream.');
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('[NotificationCenter] Failed to connect to Realtime. Check network or Supabase URL.');
                }
            });

        return () => {
            console.log(`[NotificationCenter] Unsubscribing from: ${channelName}`);
            supabase.removeChannel(channel);
        };
    }, [user]);

    const markAsRead = async (id: string) => {
        await supabase.from('notifications' as any).update({ is_read: true }).eq('id', id);
        fetchNotifications();
    };

    const handleAction = async (notif: any) => {
        await markAsRead(notif.id);
        if (notif.link) navigate(notif.link);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'chat_request': return <MessageSquare className="h-4 w-4 text-primary" />;
            case 'grade_posted': return <GraduationCap className="h-4 w-4 text-green-500" />;
            case 'announcement': return <Bell className="h-4 w-4 text-primary" />;
            default: return <ShieldAlert className="h-4 w-4 text-muted-foreground" />;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-muted/50 transition-colors">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white ring-2 ring-background animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 border-none shadow-premium rounded-2xl overflow-hidden">
                <div className="p-4 bg-muted/30 border-b flex items-center justify-between">
                    <h3 className="font-bold text-sm">Notifications</h3>
                    <Badge variant="outline" className="text-[10px] font-black">{unreadCount} New</Badge>
                </div>
                <ScrollArea className="h-80">
                    {notifications.length === 0 ? (
                        <div className="p-10 text-center space-y-2">
                            <Bell className="h-8 w-8 mx-auto opacity-10" />
                            <p className="text-xs text-muted-foreground">All caught up!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={`p-4 flex gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${!n.is_read ? 'bg-primary/5' : ''}`}
                                    onClick={() => handleAction(n)}
                                >
                                    <div className="mt-1">{getIcon(n.type)}</div>
                                    <div className="flex-1 space-y-1">
                                        <p className={`text-xs ${!n.is_read ? 'font-bold' : 'text-muted-foreground'}`}>{n.title}</p>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">{n.message}</p>
                                        <p className="text-[9px] text-muted-foreground opacity-60">
                                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                        </p>
                                    </div>
                                    {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary mt-2" />}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                {notifications.length > 0 && (
                    <div className="p-2 bg-muted/10 border-t">
                        <Button
                            variant="ghost"
                            className="w-full text-[10px] font-bold uppercase tracking-widest h-8"
                            onClick={async () => {
                                await supabase.from('notifications' as any).update({ is_read: true }).eq('user_id', user?.id);
                                fetchNotifications();
                            }}
                        >
                            Mark all as read
                        </Button>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default NotificationCenter;
