import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { fetchAuthUserBundle } from '@/mvc/services/authService';
import type { AppRole, Profile } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  permissions: string[];
  loading: boolean;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  permissions: [],
  loading: true,
  signOut: async () => {},
  fetchProfile: async () => {},
  hasPermission: () => false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      const bundle = await fetchAuthUserBundle(userId);
      setProfile(bundle.profile);
      setRole(bundle.role);
      setPermissions(bundle.permissions);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        void (supabase.from('activity_logs') as any)
          .insert([
            {
              user_id: nextSession.user.id,
              action: 'LOGIN',
              entity_type: 'auth',
              created_at: new Date().toISOString(),
            },
          ] as any)
          .then((res: { error: { message: string } | null }) => {
            if (res.error) console.warn('[UniHub] activity_logs insert skipped:', res.error.message);
          });
        setTimeout(() => fetchUserData(nextSession.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
        setPermissions([]);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      setSession(initial);
      setUser(initial?.user ?? null);
      if (initial?.user) {
        fetchUserData(initial.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Supabase signOut error:', error);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      setPermissions([]);
      window.location.assign('/login');
    }
  };

  const fetchProfile = async () => {
    if (user) await fetchUserData(user.id);
  };

  const hasPermission = (permission: string) => {
    return role === 'admin' || permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        permissions,
        loading,
        signOut,
        fetchProfile,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
