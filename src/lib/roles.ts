/** Role helpers for UniHub (three roles: admin, lecturer, student). */

export function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin';
}

export function isStaffRole(role: string | null | undefined): boolean {
  return role === 'lecturer' || isAdminRole(role);
}
