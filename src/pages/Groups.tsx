import { useEffect, useState, useRef, useCallback } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, MessageSquare, UserPlus, MoreVertical, Send,
  Search, ArrowLeft, Trash2, UserCheck,
  Users, ShieldAlert, Heart, Loader2, Paperclip, FileArchive, File as FileIcon, X,
  Crown, LogOut, UserMinus,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  loadSocialBasics,
  loadGroupMembersMerged,
  fetchDirectMessagesForChat,
  fetchGroupCreatorProfile,
  createGroupRecord,
  addGroupMember,
  removeGroupMemberRow,
  updateGroupMemberRole,
  insertDirectMessage,
  uploadChatMedia,
  markChatRead,
  deleteChatContactPair,
  upsertChatContact,
  insertChatContactRequest,
  fetchAllGroups,
  sendJoinRequest,
  cancelJoinRequest,
} from '@/mvc/services/socialHubService';

/** Max attachment size (keep in sync with storage.buckets file_size_limit for `chat-media`). */
const CHAT_MAX_FILE_BYTES = 50 * 1024 * 1024;

/** randomUUID() is missing on HTTP (non-localhost); LAN dev URLs like http://192.168.x.x need a fallback. */
function randomStorageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
}

function validateChatAttachment(file: File): string | null {
  if (file.size <= 0) return 'File is empty.';
  if (file.size > CHAT_MAX_FILE_BYTES) {
    return `Files must be ${CHAT_MAX_FILE_BYTES / (1024 * 1024)}MB or smaller.`;
  }
  return null;
}

function MessageAttachmentView({
  path,
  mime,
  name,
}: {
  path: string;
  mime: string | null;
  name: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = Boolean(mime?.startsWith('image/'));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600);
      if (!cancelled) {
        if (!error && data?.signedUrl) setUrl(data.signedUrl);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  const openDownload = useCallback(async () => {
    const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }, [path]);

  if (isImage) {
    if (loading) return <p className="text-[10px] opacity-70 mt-1">Loading image…</p>;
    if (url) {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block max-w-[min(280px,70vw)]">
          <img src={url} alt={name || 'Attachment'} className="rounded-xl border border-white/20 max-h-56 w-auto object-contain" />
        </a>
      );
    }
    return <p className="text-[10px] opacity-70">Could not load image.</p>;
  }

  const lower = (name || '').toLowerCase();
  const isZip =
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    lower.endsWith('.zip');
  const FileGlyph = isZip ? FileArchive : FileIcon;

  return (
    <button
      type="button"
      onClick={() => void openDownload()}
      className="mt-2 flex items-center gap-2 rounded-xl border border-current/20 bg-black/5 px-3 py-2 text-left text-xs font-semibold transition hover:bg-black/10"
    >
      <FileGlyph className="h-4 w-4 shrink-0" />
      <span className="truncate">{name || 'File'}</span>
    </button>
  );
}

const Groups = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // High-level state
  const [chatType, setChatType] = useState<'groups' | 'direct' | 'discover'>('direct');
  const [loading, setLoading] = useState(true);

  // Groups State
  const [groups, setGroups] = useState<any[]>([]);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [groupMemberships, setGroupMemberships] = useState<Record<string, string>>({});
  const [joinRequests, setJoinRequests] = useState<Record<string, string>>({});

  // Direct Messages State
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null); // Can be group or profile
  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedChatRef = useRef<typeof selectedChat>(null);
  const [pendingFile, setPendingFile] = useState<{ file: File; previewUrl?: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  // Search Queries
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [peerSearch, setPeerSearch] = useState('');

  const [groupCreator, setGroupCreator] = useState<{ full_name: string; user_id: string } | null>(null);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [isGroupManageOpen, setIsGroupManageOpen] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');

  const fetchBasics = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const payload = await loadSocialBasics(user.id);
      setGroups(payload.groups);
      setContacts(payload.contacts);
      setAllUsers(payload.directoryUsers);
      setUnreadMap(payload.unreadMap);

      // Fetch all groups for discovery
      const allG = await fetchAllGroups();
      setAllGroups(allG || []);

      // Build membership map
      const memberships: Record<string, string> = {};
      const requests: Record<string, string> = {};
      for (const g of payload.groups) {
        if (g.group_members) {
          const mem = g.group_members.find((m: any) => m.user_id === user.id);
          if (mem) memberships[g.id] = mem.role || 'member';
        }
      }
      
      // Check join requests
      if (allG) {
        for (const g of allG) {
          const { data: req } = await supabase.from('group_join_requests').select('status').eq('group_id', g.id).eq('user_id', user.id).maybeSingle();
          if (req) requests[g.id] = req.status;
        }
      }
      
      setGroupMemberships(memberships);
      setJoinRequests(requests);
    } catch (error: any) {
      console.error('Fetch Basics Error:', error);
      toast({ title: 'Fetch failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadGroupMembersForGroup = async (groupId: string) => {
    try {
      const merged = await loadGroupMembersMerged(groupId);
      setMembers(merged);
    } catch (gmErr: any) {
      console.error('group_members fetch:', gmErr);
      toast({ title: 'Could not load group members', description: gmErr.message, variant: 'destructive' });
      setMembers([]);
    }
  };

  const fetchMessages = async (chat: any) => {
    if (!user || !chat) return;
    try {
      const data = await fetchDirectMessagesForChat(chat, user.id);
      setMessages(data);

      if (!chat.user_id) {
        await loadGroupMembersForGroup(chat.id);
      }
    } catch (error: any) {
      console.error('Msg fetch error:', error);
    }
  };

  useEffect(() => {
    if (!selectedChat?.id) {
      setGroupCreator(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const p = await fetchGroupCreatorProfile(selectedChat.id);
      if (!cancelled) setGroupCreator(p ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChat?.id]);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (user) fetchBasics();

    const contactSub = supabase.channel('social_updates')
      .on('postgres_changes', { event: '*', table: 'chat_contacts', schema: 'public' }, () => fetchBasics())
      .on('postgres_changes', { event: '*', table: 'groups', schema: 'public' }, () => fetchBasics())
      .on('postgres_changes', { event: '*', table: 'group_members', schema: 'public' }, () => {
        void fetchBasics();
        const c = selectedChatRef.current;
        if (c?.id) void fetchMessages(c);
      })
      .subscribe();

    return () => { supabase.removeChannel(contactSub); };
  }, [user]);

  useEffect(() => {
    if (!selectedChat) return;
    fetchMessages(selectedChat);

    // 1. Mark as Read Locally
    setUnreadMap(prev => {
      const next = { ...prev };
      delete next[selectedChat.id || selectedChat.user_id];
      return next;
    });

    // 2. Mark as Read in Database (Persistent)
    const markRead = async () => {
      const isGroup = !!selectedChat.id;
      let dbId = selectedChat.id;
      if (!isGroup) {
        // Find the chat_contact record ID
        const relationship = contacts.find(c => c.profile?.user_id === selectedChat.user_id);
        dbId = relationship?.id;
      }
      if (dbId) {
        await markChatRead(dbId, isGroup);
      }
    };
    markRead();

    // Dynamic channel name based on context
    // For direct chats, we sort the IDs so both parties end up in the same channel room
    const sortedDirectIds = selectedChat.user_id ? [user?.id, selectedChat.user_id].sort().join('_') : '';
    const channelId = selectedChat.id ? `group_${selectedChat.id}` : `direct_${sortedDirectIds}`;
    const msgSub = supabase.channel(`msgs_${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        table: 'direct_messages',
        schema: 'public'
      }, (payload) => {
        const newMsg = payload.new as any;
        console.log('[SocialHub] New Message Received:', newMsg);

        const isRelevant = (selectedChat.id && newMsg.group_id === selectedChat.id) ||
          (!selectedChat.id && (
            (newMsg.sender_id === selectedChat.user_id && newMsg.receiver_id === user?.id) ||
            (newMsg.sender_id === user?.id && newMsg.receiver_id === selectedChat.user_id)
          ));

        if (isRelevant) {
          // Refetch messages for current chat
          fetchMessages(selectedChat);
          // Force scroll
          setTimeout(() => {
            scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 300);
        } else {
          // If not in current chat, show a notification toast
          // and refresh sidebar to show new sorting/indicator
          fetchBasics();

          if (newMsg.sender_id !== user?.id) {
            setUnreadMap(prev => ({ ...prev, [newMsg.group_id || newMsg.sender_id]: true }));
            toast({
              title: "New Message",
              description: "You have a new message in a different thread.",
              className: "bg-primary text-white font-bold rounded-2xl shadow-premium"
            });
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(msgSub); };
  }, [selectedChat, user]);

  const clearPendingFile = () => {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onPickAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateChatAttachment(file);
    if (err) {
      toast({ title: 'Invalid file', description: err, variant: 'destructive' });
      e.target.value = '';
      return;
    }
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setPendingFile({ file, previewUrl });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMessage.trim();
    if ((!text && !pendingFile) || !selectedChat || !user || uploading) return;

    // Check relationship status for direct chats
    if (!selectedChat.id) {
      const rel = contacts.find(c => c.profile?.user_id === selectedChat.user_id);
      if (rel?.status === 'blocked') {
        toast({ title: 'User Blocked', description: 'Unblock to send messages.', variant: 'destructive' });
        return;
      }
      if (rel?.status !== 'accepted') {
        toast({ title: 'Chat Not Accepted', description: 'Conversation must be accepted by both parties before chatting.', variant: 'destructive' });
        return;
      }
    }

    setUploading(true);
    try {
      let attachment_path: string | undefined;
      let attachment_name: string | undefined;
      let attachment_mime: string | undefined;

      if (pendingFile) {
        const f = pendingFile.file;
        const v = validateChatAttachment(f);
        if (v) {
          toast({ title: 'Invalid file', description: v, variant: 'destructive' });
          return;
        }
        const ext =
          f.name.includes('.') ? f.name.split('.').pop()!.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'bin' : 'bin';
        const path = `${user.id}/${randomStorageId()}.${ext}`;
        const { error: upErr } = await uploadChatMedia(path, f);
        if (upErr) throw upErr;
        attachment_path = path;
        attachment_name = f.name;
        attachment_mime = f.type && f.type.length > 0 ? f.type : 'application/octet-stream';
      }

      const payload: Record<string, unknown> = {
        sender_id: user.id,
        content: text || '',
      };
      if (attachment_path) {
        payload.attachment_path = attachment_path;
        payload.attachment_name = attachment_name;
        payload.attachment_mime = attachment_mime;
      }

      if (selectedChat.id) payload.group_id = selectedChat.id;
      else payload.receiver_id = selectedChat.user_id;

      await insertDirectMessage(payload);
      setNewMessage('');
      clearPendingFile();
      fetchMessages(selectedChat);
    } catch (error: any) {
      toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSocialAction = async (targetId: string, action: 'accept' | 'block' | 'remove' | 'request') => {
    if (!user) return;
    try {
      if (action === 'remove') {
        await deleteChatContactPair(user.id, targetId);
      } else {
        let status: 'pending' | 'accepted' | 'blocked';
        if (action === 'request') status = 'pending';
        else if (action === 'accept') status = 'accepted';
        else status = 'blocked';
        await upsertChatContact(user.id, targetId, status);
      }
      toast({ title: 'Success', description: `User relationship updated.` });
      fetchBasics();
    } catch (error: any) {
      toast({ title: 'Action failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleStartChat = async (profile: any) => {
    if (!user) return;
    try {
      const existing = contacts.find(c => c.profile?.user_id === profile.user_id);
      if (!existing) {
        await insertChatContactRequest(user.id, profile.user_id);
        toast({ title: 'Chat Request Sent', description: `A connection request has been sent to ${profile.full_name}.` });
      }
      setSelectedChat(profile);
      setIsSearchOpen(false);
      fetchBasics();
    } catch (error: any) {
      toast({ title: 'Failed to start chat', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const row = await createGroupRecord(newGroupName, newGroupDesc, user.id);
      if (!row) throw new Error('Group was not created');

      setIsCreateOpen(false);
      setNewGroupName('');
      setNewGroupDesc('');
      toast({ title: 'Group Created', description: `Welcome to ${newGroupName}!` });
      setChatType('groups');
      setSelectedChat(row);
      fetchBasics();
    } catch (error: any) {
      toast({ title: 'Creation failed', description: error.message, variant: 'destructive' });
    }
  };

  const isGroupAdmin = Boolean(
    selectedChat?.id && user && members.some((m: any) => m.user_id === user.id && m.role === 'admin')
  );
  const adminCount = members.filter((m: any) => m.role === 'admin').length;

  const memberUserIds = new Set(members.map((m: any) => m.user_id));

  const handleAddMemberToGroup = async (peerUserId: string) => {
    if (!selectedChat?.id || !user) return;
    if (memberUserIds.has(peerUserId)) {
      toast({ title: 'Already in group', variant: 'destructive' });
      return;
    }
    try {
      await addGroupMember(selectedChat.id, peerUserId);
      toast({ title: 'Member added', description: 'They can now see this group chat.' });
      setIsAddMembersOpen(false);
      setAddMemberSearch('');
      await fetchMessages(selectedChat);
      fetchBasics();
    } catch (error: any) {
      toast({ title: 'Could not add member', description: error.message, variant: 'destructive' });
    }
  };

  const handleRemoveMemberFromGroup = async (rowId: string, displayName: string) => {
    if (!selectedChat?.id) return;
    if (!window.confirm(`Remove ${displayName} from this group?`)) return;
    try {
      await removeGroupMemberRow(rowId);
      toast({ title: 'Member removed' });
      await fetchMessages(selectedChat);
      fetchBasics();
    } catch (error: any) {
      toast({ title: 'Remove failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleSetMemberRole = async (rowId: string, role: 'admin' | 'member') => {
    if (!selectedChat?.id) return;
    try {
      await updateGroupMemberRole(rowId, role);
      toast({ title: role === 'admin' ? 'Now a group admin' : 'Role updated' });
      await fetchMessages(selectedChat);
      fetchBasics();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedChat?.id || !user) return;
    const row = members.find((m: any) => m.user_id === user.id);
    if (!row) return;
    if (row.role === 'admin' && adminCount <= 1) {
      toast({
        title: 'Cannot leave',
        description: 'Make someone else an admin first, or delete the group from the database.',
        variant: 'destructive',
      });
      return;
    }
    if (!window.confirm('Leave this group? You will need to be re-added to return.')) return;
    try {
      await removeGroupMemberRow(row.id);
      toast({ title: 'You left the group' });
      setSelectedChat(null);
      setIsGroupManageOpen(false);
      fetchBasics();
    } catch (error: any) {
      toast({ title: 'Leave failed', description: error.message, variant: 'destructive' });
    }
  };

  const renderAddMembersPicker = () => (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          className="pl-9 h-11 bg-muted/30 border-none rounded-xl"
          value={addMemberSearch}
          onChange={(e) => setAddMemberSearch(e.target.value)}
        />
      </div>
      <ScrollArea className="h-64 rounded-xl border p-2">
        <div className="space-y-1">
          {allUsers
            .filter((u) => u.user_id !== user?.id && !memberUserIds.has(u.user_id))
            .filter(
              (u) =>
                u.full_name?.toLowerCase().includes(addMemberSearch.toLowerCase()) ||
                u.email?.toLowerCase().includes(addMemberSearch.toLowerCase())
            )
            .map((u) => (
              <div
                key={u.user_id}
                className="flex items-center justify-between gap-2 rounded-xl p-2 hover:bg-muted/50"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={u.avatar_url} />
                    <AvatarFallback>{u.full_name?.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{u.full_name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <Button size="sm" className="shrink-0 rounded-full" onClick={() => void handleAddMemberToGroup(u.user_id)}>
                  Add
                </Button>
              </div>
            ))}
          {allUsers.filter((u) => u.user_id !== user?.id && !memberUserIds.has(u.user_id)).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Everyone is already here.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const renderMemberRows = (compact?: boolean) => (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {members.map((m: any) => {
        const isSelf = m.user_id === user?.id;
        const isRowAdmin = m.role === 'admin';
        const canDemote = !(isRowAdmin && adminCount <= 1);
        return (
          <div
            key={m.id}
            className={`flex items-center gap-2 rounded-xl border border-transparent ${compact ? 'p-2' : 'p-3'} hover:bg-muted/40`}
          >
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={m.profiles?.avatar_url} />
              <AvatarFallback>{m.profiles?.full_name?.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-bold">{m.profiles?.full_name || 'Member'}</p>
                {isRowAdmin && (
                  <Badge variant="secondary" className="h-4 gap-0.5 px-1.5 text-[8px] font-bold uppercase">
                    <Crown className="h-2.5 w-2.5" /> Admin
                  </Badge>
                )}
                {groupCreator?.user_id === m.user_id && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[8px]">
                    Creator
                  </Badge>
                )}
              </div>
              <p className="truncate text-[9px] text-muted-foreground">{m.profiles?.email}</p>
            </div>
            {isGroupAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!isSelf && isRowAdmin && canDemote && (
                    <DropdownMenuItem onClick={() => void handleSetMemberRole(m.id, 'member')}>
                      Remove admin
                    </DropdownMenuItem>
                  )}
                  {!isSelf && !isRowAdmin && (
                    <DropdownMenuItem onClick={() => void handleSetMemberRole(m.id, 'admin')}>Make admin</DropdownMenuItem>
                  )}
                  {!isSelf && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => void handleRemoveMemberFromGroup(m.id, m.profiles?.full_name || 'Member')}
                    >
                      <UserMinus className="mr-2 h-4 w-4" /> Remove from group
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-140px)] gap-6 animate-fade-in overflow-hidden">
        {/* Unified Sidebar */}
        <div className={`flex flex-col w-full lg:w-[350px] h-full border rounded-2xl bg-card shadow-[0_8px_30px_rgb0,0,0,0.12] transition-all sticky top-0 z-10 ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold font-heading text-primary flex items-center gap-2">
                UniHub Social
              </h2>
              <div className="flex gap-2">
                {chatType === 'direct' && (
                  <Button size="icon" variant="ghost" onClick={() => setIsSearchOpen(true)} className="rounded-full hover:bg-primary/10">
                    <UserPlus className="h-5 w-5" />
                  </Button>
                )}
                {chatType === 'groups' && (
                  <Button size="icon" variant="ghost" onClick={() => setIsCreateOpen(true)} className="rounded-full hover:bg-primary/10">
                    <Plus className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>

            <Tabs value={chatType} onValueChange={(v) => setChatType(v as 'groups' | 'direct' | 'discover')}>
              <TabsList className="grid w-full grid-cols-3 p-1 bg-muted/50 rounded-xl">
                <TabsTrigger value="direct" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">Direct</TabsTrigger>
                <TabsTrigger value="groups" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">My Groups</TabsTrigger>
                <TabsTrigger value="discover" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">Discover</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                className="pl-9 h-11 bg-muted/20 border-none rounded-xl"
                value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-48 space-y-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin opacity-20" />
<p className="text-[10px] font-bold uppercase tracking-widest">Retrieving Threads</p>
                  </div>
                ) : chatType === 'direct' ? (
                  contacts.filter(c => c.profile?.full_name?.toLowerCase().includes(sidebarSearch.toLowerCase())).length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No chats found.</p>
                    </div>
                  ) : contacts.filter(c => c.profile?.full_name?.toLowerCase().includes(sidebarSearch.toLowerCase())).map(chat => (
                    <button key={chat.id} onClick={() => chat.profile && setSelectedChat(chat.profile)} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${selectedChat?.user_id === chat.profile?.user_id ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]' : 'hover:bg-muted/50'}`}>
                      <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                        <AvatarImage src={chat.profile?.avatar_url} />
                        <AvatarFallback className={selectedChat?.user_id === chat.profile?.user_id ? 'bg-white/20' : 'gradient-primary text-white'}>{chat.profile?.full_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left overflow-hidden">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-sm truncate ${unreadMap[chat.id] && selectedChat?.user_id !== chat.profile?.user_id ? 'font-black text-foreground' : 'font-bold'}`}>{chat.profile?.full_name}</span>
                          {chat.status === 'pending' && <Badge variant="secondary" className="text-[8px] h-3 px-1 bg-yellow-500 text-white">REQUEST</Badge>}
                          {unreadMap[chat.id] && selectedChat?.user_id !== chat.profile?.user_id && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                        </div>
                        <p className={`text-xs truncate ${selectedChat?.user_id === chat.profile?.user_id ? 'text-primary-foreground/70' : 'text-muted-foreground'} ${unreadMap[chat.id] && selectedChat?.user_id !== chat.profile?.user_id ? 'font-bold' : ''}`}>
                          {chat.status === 'blocked' ? '[Blocked]' : (chat.last_message_content || 'No messages yet')}
                        </p>
                      </div>
                    </button>
                  ))
                ) : chatType === 'groups' ? (
                  groups.map(group => (
                    <button
                    key={group.id}
                    onClick={() => {
                      setChatType('groups');
                      setSelectedChat(group);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${selectedChat?.id === group.id
                      ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]'
                      : 'hover:bg-muted/50'
                      }`}
                  >
                    <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                      <AvatarFallback className={selectedChat?.id === group.id ? 'bg-white/20' : 'gradient-indigo text-white'}>
                        {group.name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm truncate block ${unreadMap[group.id] && selectedChat?.id !== group.id ? 'font-black text-foreground' : 'font-bold'}`}>
                          {group.name}
                        </span>
                        {unreadMap[group.id] && selectedChat?.id !== group.id && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                      </div>
                      <p className={`text-xs truncate ${selectedChat?.id === group.id ? 'text-primary-foreground/70' : 'text-muted-foreground'} ${unreadMap[group.id] && selectedChat?.id !== group.id ? 'font-bold' : ''}`}>
                        {group.last_message_content ||
                          `Circle of ${Array.isArray(group.group_members) ? group.group_members.length : '—'} members`}
                      </p>
                    </div>
                  </button>
                ))
                ) : chatType === 'discover' ? (
                  allGroups.filter(g => g.name?.toLowerCase().includes(sidebarSearch.toLowerCase())).length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No groups to discover.</p>
                    </div>
                  ) : (
                    allGroups
                      .filter(g => g.name?.toLowerCase().includes(sidebarSearch.toLowerCase()))
                      .map(group => {
                        const memStatus = groupMemberships[group.id];
                        const reqStatus = joinRequests[group.id];
                        return (
                          <button
                            key={group.id}
                            onClick={() => memStatus && (setChatType('groups'), setSelectedChat(group))}
                            className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all hover:bg-muted/50"
                          >
                            <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                              <AvatarFallback className="gradient-indigo text-white">
                                {group.name?.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left overflow-hidden">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-bold truncate">{group.name}</span>
                                {memStatus ? (
                                  <Badge variant="secondary" className="text-[10px]">Member</Badge>
                                ) : reqStatus === 'pending' ? (
                                  <Badge variant="outline" className="text-[10px]">Pending</Badge>
                                ) : (
                                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await sendJoinRequest(group.id, user.id);
                                      setJoinRequests({ ...joinRequests, [group.id]: 'pending' });
                                      toast({ title: 'Request sent', description: 'Your join request has been sent.' });
                                    } catch (err: any) {
                                      toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                    }
                                  }}>Join</Button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{group.description || 'No description'}</p>
                            </div>
                          </button>
                        );
                      })
                  )
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Select a tab to view chats.</p>
                  </div>
                )}
            </div>
          </ScrollArea>
        </div>

        {/* Messaging Area */}
        <div className={`flex-1 flex flex-col h-full border rounded-2xl bg-card overflow-hidden shadow-premium ${!selectedChat ? 'hidden lg:flex items-center justify-center bg-muted/20' : 'flex'}`}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center justify-between bg-card/80 backdrop-blur sticky top-0 z-20">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSelectedChat(null)}><ArrowLeft className="h-5 w-5" /></Button>
                  <Avatar className="border-2 border-primary/10">
                    <AvatarImage src={selectedChat.avatar_url} />
                    <AvatarFallback className="gradient-primary text-white font-bold">{selectedChat.name?.slice(0, 2).toUpperCase() || selectedChat.full_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold font-heading text-foreground leading-none mb-1">{selectedChat.name || selectedChat.full_name}</h3>
                    <p className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-0.5">
                      {selectedChat.id ? (
                        <>
                          <span>{members.length} members</span>
                          <span>·</span>
                          <span>Created by {groupCreator?.full_name ?? '…'}</span>
                          <span>·</span>
                          <span className="font-semibold text-primary/80">{isGroupAdmin ? 'You are admin' : 'Member'}</span>
                        </>
                      ) : (
                        (contacts.find((c) => (c as any).profile?.user_id === selectedChat.user_id)?.status || 'active').toUpperCase()
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!selectedChat.id && (
                    <>
                      {contacts.find(c => (c as any).profile?.user_id === selectedChat.user_id)?.status === 'pending' && contacts.find(c => (c as any).profile?.user_id === selectedChat.user_id)?.user_id !== user?.id && (
                        <Button size="sm" variant="default" className="h-8 gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleSocialAction(selectedChat.user_id, 'accept')}>
                          <UserCheck className="h-4 w-4" /> Accept
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleSocialAction(selectedChat.user_id, 'block')} className="text-destructive">
                            <ShieldAlert className="h-4 w-4 mr-2" /> Block User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSocialAction(selectedChat.user_id, 'remove')} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Remove Chat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                  {selectedChat.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isGroupAdmin && (
                          <DropdownMenuItem
                            onClick={() => {
                              setIsAddMembersOpen(true);
                              setAddMemberSearch('');
                            }}
                          >
                            <UserPlus className="mr-2 h-4 w-4" /> Add members
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setIsGroupManageOpen(true)}>
                          <Users className="mr-2 h-4 w-4" /> Group details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => void handleLeaveGroup()}>
                          <LogOut className="mr-2 h-4 w-4" /> Leave group
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {!selectedChat.id && contacts.find(c => (c as any).profile?.user_id === selectedChat.user_id)?.status === 'blocked' && (
                <div className="bg-destructive/10 p-4 text-center text-destructive flex items-center justify-center gap-2 border-b">
                  <ShieldAlert className="h-4 w-4" /> You have blocked this user. Unblock to chat.
                </div>
              )}

              <ScrollArea className="flex-1 p-6 bg-muted/5 relative">
                <div className="space-y-6">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20 filter grayscale">
                      <Heart className="h-16 w-16 mb-4 animate-pulse text-primary" />
                      <p className="font-bold">Start a beautiful conversation</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isOwn = msg.sender_id === user?.id;
                      const showProfile = !isOwn && (!messages[i - 1] || messages[i - 1].sender_id !== msg.sender_id);

                      return (
                        <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex items-end gap-2 max-w-[75%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                            <Avatar className={`h-6 w-6 border ${showProfile ? 'opacity-100' : 'opacity-0'}`}>
                              <AvatarFallback className="text-[10px] bg-muted">{msg.profiles?.full_name?.slice(0, 1)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              {showProfile && <span className="text-[8px] font-bold uppercase text-muted-foreground ml-2 mb-1">{msg.profiles?.full_name}</span>}
                              <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-premium ${isOwn
                                ? 'bg-primary text-primary-foreground rounded-tr-none'
                                : 'bg-card text-foreground rounded-tl-none border'
                                }`}>
                                {msg.content ? <p className="whitespace-pre-wrap break-words">{msg.content}</p> : null}
                                {msg.attachment_path ? (
                                  <MessageAttachmentView
                                    path={msg.attachment_path}
                                    mime={msg.attachment_mime}
                                    name={msg.attachment_name}
                                  />
                                ) : null}
                                <div className={`text-[8px] mt-1 text-right opacity-60`}>
                                  {msg.created_at ? format(new Date(msg.created_at), 'HH:mm') : '...'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              <div className="p-4 bg-card border-t group">
                {(!selectedChat.id && contacts.find(c => (c as any).profile?.user_id === selectedChat.user_id)?.status !== 'accepted') ? (
                  <div className="flex flex-col items-center gap-3 p-2 bg-muted/20 rounded-2xl border border-dashed">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <ShieldAlert className="h-3 w-3" />
                      {!contacts.find(c => (c as any).profile?.user_id === selectedChat.user_id)
                        ? "Start a new connection"
                        : contacts.find(c => (c as any).profile?.user_id === selectedChat.user_id)?.status === 'blocked'
                          ? "User Blocked"
                          : contacts.find(c => (c as any).profile?.user_id === selectedChat.user_id)?.user_id === user?.id
                            ? "Waiting for acceptance..."
                            : "Accept request to start chatting"}
                    </div>
                    {!contacts.find(c => (c as any).profile?.user_id === selectedChat.user_id) ? (
                      <Button className="w-full gradient-primary h-11 rounded-xl font-bold" onClick={() => handleSocialAction(selectedChat.user_id, 'request')}>
                        Send Connection Request
                      </Button>
                    ) : (contacts.find(c => (c as any).profile?.user_id === selectedChat.user_id)?.status === 'pending' && contacts.find(c => (c as any).profile?.user_id === selectedChat.user_id)?.user_id !== user?.id) && (
                      <Button className="w-full gradient-primary h-11 rounded-xl font-bold" onClick={() => handleSocialAction(selectedChat.user_id, 'accept')}>
                        Accept and Chat
                      </Button>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="space-y-2">
                    {pendingFile && (
                      <div className="flex items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-muted/20 p-2 pr-3">
                        {pendingFile.previewUrl ? (
                          <img src={pendingFile.previewUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
                            <FileIcon className="h-7 w-7 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{pendingFile.file.name}</p>
                          <p className="text-[10px] text-muted-foreground">Add a caption (optional) and send</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={clearPendingFile}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={onPickAttachment}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 shrink-0 rounded-2xl border-dashed"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                        title={`Attach file (max ${CHAT_MAX_FILE_BYTES / (1024 * 1024)}MB)`}
                      >
                        <Paperclip className="h-5 w-5" />
                      </Button>
                      <Input
                        placeholder={pendingFile ? 'Caption (optional)…' : `Message or attach a file (max ${CHAT_MAX_FILE_BYTES / (1024 * 1024)}MB)…`}
                        className="flex-1 h-12 bg-muted/30 border-none rounded-2xl px-6 focus-visible:ring-primary shadow-inner text-sm"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        disabled={uploading}
                      />
                      <Button
                        type="submit"
                        size="icon"
                        className="h-12 w-12 rounded-2xl gradient-primary shadow-premium group-hover:scale-105 transition-transform"
                        disabled={uploading || (!newMessage.trim() && !pendingFile)}
                      >
                        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                <MessageSquare className="h-24 w-24 text-primary relative" />
              </div>
              <div className="max-w-xs space-y-2">
                <h3 className="text-2xl font-bold font-heading text-foreground">Social Hub</h3>
                <p className="text-muted-foreground text-sm">Connect with people, join study circles, and collaborate in real-time.</p>
              </div>
              <Button className="gradient-primary rounded-2xl px-10 py-6 font-bold shadow-premium" onClick={() => setIsSearchOpen(true)}>
                Find people 
              </Button>
            </div>
          )}
        </div>

        {selectedChat?.id && (
          <div className="hidden lg:flex flex-col w-[min(100%,24rem)] min-w-[300px] max-w-md h-full border rounded-2xl bg-card shadow-premium overflow-hidden">
            <div className="border-b p-6 text-center">
              <Avatar className="mx-auto mb-3 h-20 w-20 border-4 border-primary/10 shadow-lg">
                <AvatarFallback className="gradient-indigo text-2xl font-bold text-white">
                  {selectedChat.name?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-heading text-lg font-bold">{selectedChat.name}</h3>
              <p className="mt-2 px-2 text-xs italic text-muted-foreground">"{selectedChat.description || 'No description'}"</p>
              <p className="mt-3 text-[10px] text-muted-foreground">
                Created by <span className="font-semibold text-foreground">{groupCreator?.full_name ?? '—'}</span>
              </p>
              {isGroupAdmin && (
                <Button
                  className="mt-4 w-full rounded-xl"
                  variant="secondary"
                  onClick={() => {
                    setIsAddMembersOpen(true);
                    setAddMemberSearch('');
                  }}
                >
                  <UserPlus className="mr-2 h-4 w-4" /> Add members
                </Button>
              )}
            </div>
            <div className="flex flex-1 flex-col overflow-hidden p-4">
              <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Users className="h-3 w-3" /> Members ({members.length})
              </h4>
              <ScrollArea className="flex-1 pr-2">
                {renderMemberRows()}
              </ScrollArea>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-3xl border-none shadow-premium">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading">New Study Circle</DialogTitle>
            <DialogDescription>Create a space for deep collaboration.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label>Circle Name</Label>
              <Input placeholder="e.g. quantum_physics_devs" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} required className="h-12 bg-muted/30 border-none rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Vision / Description</Label>
              <Input placeholder="What are we solving?" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} className="h-12 bg-muted/30 border-none rounded-xl" />
            </div>
            <Button type="submit" className="w-full h-12 gradient-primary font-bold rounded-xl shadow-premium">Launch Hub</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddMembersOpen} onOpenChange={setIsAddMembersOpen}>
        <DialogContent className="max-h-[90vh] rounded-3xl border-none shadow-premium sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Add to group</DialogTitle>
            <DialogDescription>Choose people from the directory. They must have a profile in the system.</DialogDescription>
          </DialogHeader>
          <div className="pt-2">{renderAddMembersPicker()}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGroupManageOpen} onOpenChange={setIsGroupManageOpen}>
        <DialogContent className="max-h-[90vh] rounded-3xl border-none shadow-premium sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">{selectedChat?.name || 'Group'}</DialogTitle>
            <DialogDescription>
              Created by {groupCreator?.full_name ?? '—'} · {members.length} members ·{' '}
              {isGroupAdmin ? 'You can manage members' : 'You are a member'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pt-2">
            {isGroupAdmin && (
              <Button
                className="w-full rounded-xl"
                variant="secondary"
                onClick={() => {
                  setIsGroupManageOpen(false);
                  setIsAddMembersOpen(true);
                  setAddMemberSearch('');
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" /> Add members
              </Button>
            )}
            {renderMemberRows(true)}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="rounded-3xl border-none shadow-premium sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Find poeple</DialogTitle>
            <DialogDescription>Search for classmates by name or email to start a direct connection.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or email..."
                className="pl-9 h-12 bg-muted/30 border-none rounded-xl"
                value={peerSearch}
                onChange={e => setPeerSearch(e.target.value)}
              />
            </div>
            <ScrollArea className="h-64 rounded-xl border p-2">
              <div className="space-y-2">
                {allUsers
                  .filter(u => u.user_id !== user?.id)
                  .filter(u =>
                    u.full_name?.toLowerCase().includes(peerSearch.toLowerCase()) ||
                    u.email?.toLowerCase().includes(peerSearch.toLowerCase())
                  )
                  .map(u => (
                    <div key={u.user_id} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-2xl transition-all group">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10"><AvatarImage src={u.avatar_url} /><AvatarFallback>{u.full_name?.slice(0, 2)}</AvatarFallback></Avatar>
                        <div><p className="text-sm font-bold">{u.full_name}</p><p className="text-[10px] text-muted-foreground">{u.email}</p></div>
                      </div>
                      <Button size="sm" variant="ghost" className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 text-primary" onClick={() => handleStartChat(u)}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Groups;
