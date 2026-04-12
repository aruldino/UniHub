/**
 * MVC — Service (data access). Social hub: groups, DMs, directory, members.
 */
import { supabase } from '@/integrations/supabase/client';
import { computeSocialUnreadMap } from '@/mvc/models';

export async function fetchGroupsWithMembership(userId?: string) {
  let query = supabase.from('groups' as any)
    .select('*, group_members!inner(*)')
    .order('last_message_at', { ascending: false });
  
  if (userId) {
    query = (query as any).eq('group_members.user_id', userId);
  }
  
  const { data, error } = await (query as any);
  if (error) console.error('[socialHub] groups:', error);
  return data ?? [];
}

export async function fetchAllGroups() {
  const { data, error } = await (supabase.from('groups' as any)
    .select('*')
    .order('last_message_at', { ascending: false }) as any);
  if (error) console.error('[socialHub] all groups:', error);
  return data ?? [];
}

export async function fetchGroupMemberStatus(groupId: string, userId: string) {
  const { data: member } = await supabase.from('group_members').select('*').eq('group_id', groupId).eq('user_id', userId).maybeSingle();
  const { data: request } = await supabase.from('group_join_requests').select('*').eq('group_id', groupId).eq('user_id', userId).maybeSingle();
  return { member, request };
}

export async function sendJoinRequest(groupId: string, userId: string) {
  const { error } = await supabase.from('group_join_requests').insert([{ group_id: groupId, user_id: userId }]);
  if (error) throw error;

  try {
    const { data: group } = await supabase.from('groups').select('name').eq('id', groupId).maybeSingle();
    const { data: requester } = await supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle();
    
    const { data: admins, error: adminError } = await supabase.from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('role', 'admin');
    
    if (adminError) {
      console.error('[sendJoinRequest] Error fetching admins:', adminError);
    }
    
    if (admins?.length) {
      const notifications = admins.map(admin => ({
        user_id: admin.user_id,
        type: 'group_join_request',
        title: 'New Join Request',
        message: `${requester?.full_name || 'Someone'} wants to join "${group?.name || 'the group'}"`,
        link: '/groups',
        is_read: false
      }));
      
      const { error: notifError } = await supabase.from('notifications').insert(notifications);
      if (notifError) {
        console.error('[sendJoinRequest] Error inserting notifications:', notifError);
      } else {
        console.log('[sendJoinRequest] Notifications sent to', admins.length, 'admins');
      }
    }
  } catch (err) {
    console.error('[sendJoinRequest] Error:', err);
  }
}

export async function cancelJoinRequest(groupId: string, userId: string) {
  const { error } = await supabase.from('group_join_requests').delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw error;
}

export async function fetchPendingRequests(groupId: string) {
  const { data, error } = await (supabase.from('group_join_requests' as any)
    .select('*, profiles:user_id(full_name, avatar_url)')
    .eq('group_id', groupId)
    .eq('status', 'pending') as any);
  if (error) console.error('[socialHub] pending requests:', error);
  return data ?? [];
}

export async function approveJoinRequest(requestId: string, groupId: string, userId: string) {
  const { error: delErr } = await supabase.from('group_join_requests').delete().eq('id', requestId);
  if (delErr) throw delErr;
  
  const { error: insErr } = await supabase.from('group_members').insert([{ group_id: groupId, user_id: userId, role: 'member' }]);
  if (insErr) throw insErr;
}

export async function denyJoinRequest(requestId: string) {
  const { error } = await supabase.from('group_join_requests').update({ status: 'denied' }).eq('id', requestId);
  if (error) throw error;
}

export async function fetchChatContactsForUser(userId: string) {
  const { data: contactData, error: contactError } = await (supabase.from('chat_contacts' as any)
    .select(`
      *,
      contact:profiles!chat_contacts_contact_id_fkey(user_id, full_name, avatar_url, email),
      owner:profiles!chat_contacts_user_id_fkey(user_id, full_name, avatar_url, email)
    `)
    .or(`user_id.eq.${userId},contact_id.eq.${userId}`)
    .order('last_message_at', { ascending: false }) as any);

  if (contactError) throw contactError;

  const formattedContacts =
    contactData?.map((c: any) => {
      const other = c.user_id === userId ? c.contact : c.owner;
      return { ...c, profile: other };
    }).filter((c: any) => c.profile) || [];

  return formattedContacts;
}

export async function fetchDirectoryProfiles() {
  const { data, error } = await supabase.from('profiles').select('user_id, full_name, email, avatar_url');
  if (error) console.error('[socialHub] directory profiles:', error);
  return data ?? [];
}

export type SocialBasicsPayload = {
  groups: any[];
  contacts: any[];
  directoryUsers: any[];
  unreadMap: Record<string, boolean>;
};

export async function loadSocialBasics(userId: string): Promise<SocialBasicsPayload> {
  const groups = await fetchGroupsWithMembership(userId);
  const formattedContacts = await fetchChatContactsForUser(userId);
  const directoryUsers = await fetchDirectoryProfiles();
  const unreadMap = computeSocialUnreadMap(userId, groups, formattedContacts);

  return {
    groups,
    contacts: formattedContacts,
    directoryUsers,
    unreadMap,
  };
}

export async function loadGroupMembersMerged(groupId: string) {
  const { data: rows, error: gmErr } = await supabase.from('group_members').select('*').eq('group_id', groupId);
  if (gmErr) throw gmErr;
  if (!rows?.length) return [];

  const ids = rows.map((r) => r.user_id);
  const { data: profs, error: pErr } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, avatar_url')
    .in('user_id', ids);
  if (pErr) console.error('profiles merge:', pErr);

  const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
  return rows.map((r) => ({ ...r, profiles: map.get(r.user_id) }));
}

export async function fetchDirectMessagesForChat(chat: any, currentUserId: string) {
  let query = supabase
    .from('direct_messages' as any)
    .select('*, profiles!direct_messages_sender_id_fkey(full_name, avatar_url)');

  if (chat.user_id) {
    query = query.or(
      `and(sender_id.eq.${currentUserId},receiver_id.eq.${chat.user_id}),and(sender_id.eq.${chat.user_id},receiver_id.eq.${currentUserId})`,
    );
  } else {
    query = query.eq('group_id', chat.id);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchGroupCreatorProfile(groupId: string) {
  const { data: g } = await (supabase.from('groups' as any).select('created_by').eq('id', groupId).maybeSingle() as any);
  if (!g?.created_by) return null;
  const { data: p } = await supabase.from('profiles').select('full_name, user_id').eq('user_id', g.created_by).maybeSingle();
  return p ?? null;
}

export async function createGroupRecord(name: string, description: string, createdBy: string) {
  const { data, error } = await (supabase.from('groups' as any).insert([{ name, description, created_by: createdBy }]).select() as any);
  if (error) throw error;
  return data?.[0];
}

export async function addGroupMember(groupId: string, peerUserId: string) {
  const { error } = await supabase.rpc('add_group_member', {
    p_group_id: groupId,
    p_user_id: peerUserId,
  });
  if (error) throw error;
}

export async function removeGroupMemberRow(rowId: string) {
  const { error } = await (supabase.from('group_members' as any).delete().eq('id', rowId) as any);
  if (error) throw error;
}

export async function updateGroupMemberRole(rowId: string, role: 'admin' | 'member') {
  const { error } = await (supabase.from('group_members' as any).update({ role }).eq('id', rowId) as any);
  if (error) throw error;
}

export async function insertDirectMessage(payload: Record<string, unknown>) {
  const { error } = await supabase.from('direct_messages' as any).insert([payload]);
  if (error) throw error;
}


export async function uploadChatMedia(path: string, file: File) {
  return supabase.storage.from('chat-media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
}

export async function markChatRead(chatId: string, isGroup: boolean) {
  await (supabase.rpc('mark_chat_as_read', { chat_id: chatId, is_group: isGroup }) as any);
}

export async function deleteChatContactPair(currentUserId: string, targetId: string) {
  await (supabase.from('chat_contacts' as any).delete().or(
    `and(user_id.eq.${currentUserId},contact_id.eq.${targetId}),and(user_id.eq.${targetId},contact_id.eq.${currentUserId})`,
  ) as any);
}

export async function upsertChatContact(
  currentUserId: string,
  targetId: string,
  status: 'pending' | 'accepted' | 'blocked',
) {
  const { data: existing } = await (supabase.from('chat_contacts' as any)
    .select('*')
    .or(`and(user_id.eq.${currentUserId},contact_id.eq.${targetId}),and(user_id.eq.${targetId},contact_id.eq.${currentUserId})`)
    .maybeSingle() as any);

  if (existing) {
    await supabase
      .from('chat_contacts' as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('chat_contacts' as any).insert({
      user_id: currentUserId,
      contact_id: targetId,
      status,
    });
  }
}

export async function insertChatContactRequest(currentUserId: string, targetId: string) {
  await supabase.from('chat_contacts' as any).insert({
    user_id: currentUserId,
    contact_id: targetId,
    status: 'pending',
  });
}
