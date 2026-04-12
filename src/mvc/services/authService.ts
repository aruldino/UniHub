/**
 * MVC — Service (data access). Session user profile, role, permissions.
 */
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Profile } from '@/types';

export type AuthUserBundle = {
  profile: Profile | null;
  role: AppRole | null;
  permissions: string[];
};

export async function fetchAuthUserBundle(userId: string): Promise<AuthUserBundle> {
  const [profileRes, roleRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, user_id, full_name, email, avatar_url, department_id, batch, status, deleted_at, is_active, bio, phone, address, created_at, updated_at',
      )
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('user_roles').select('id, user_id, role').eq('user_id', userId).maybeSingle(),
  ]);

  const profile = profileRes.data ? (profileRes.data as unknown as Profile) : null;

  if (!roleRes.data) {
    return { profile, role: null, permissions: [] };
  }

  const userRole = (roleRes.data as unknown as { role: AppRole }).role;
  const { data: perms } = await supabase
    .from('role_permissions' as never)
    .select('permissions(name)')
    .eq('role', userRole as never);

  const permissions =
    perms?.map((p: { permissions: { name: string } }) => p.permissions.name).filter(Boolean) ?? [];

  return { profile, role: userRole, permissions };
}
