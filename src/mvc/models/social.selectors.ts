/** Pure functions over loaded models (no I/O). */

/** Build unread flags for sidebar rows from last_message vs last_read. */
export function computeSocialUnreadMap(
  userId: string,
  groups: any[],
  contacts: any[],
): Record<string, boolean> {
  const newUnread: Record<string, boolean> = {};

  groups?.forEach((g: any) => {
    const myMember = g.group_members?.find((m: any) => m.user_id === userId);
    if (
      g.last_message_at &&
      myMember?.last_read_at &&
      new Date(g.last_message_at) > new Date(myMember.last_read_at) &&
      g.sender_id !== userId
    ) {
      newUnread[g.id] = true;
    }
  });

  contacts?.forEach((c: any) => {
    const myReadAt = c.user_id === userId ? c.user_last_read_at : c.contact_last_read_at;
    if (
      c.last_message_at &&
      myReadAt &&
      new Date(c.last_message_at) > new Date(myReadAt) &&
      c.sender_id !== userId
    ) {
      newUnread[c.id] = true;
    }
  });

  return newUnread;
}
