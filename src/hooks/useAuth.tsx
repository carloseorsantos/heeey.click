import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getGuestProfile, updateGuestProfile, GuestProfile, claimLocalBoardsForUser } from '../lib/storage';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  guestProfile: GuestProfile;
  loading: boolean;
  effectiveUserId: string;
  effectiveUserName: string;
  isAuthenticated: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setNickname: (name: string, color?: { background: string; stroke: string }) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [guestProfile, setGuestProfileState] = useState<GuestProfile>(getGuestProfile());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        claimLocalBoardsForUser(session.user.id);
      }
      setLoading(false);
    }).catch((err) => {
      console.warn('Erro ao obter sessão do Supabase:', err);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        claimLocalBoardsForUser(session.user.id);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.href,
        },
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
    setUser(null);
    setSession(null);
  }, []);

  const setNickname = useCallback((name: string, color?: { background: string; stroke: string }) => {
    const updated = updateGuestProfile({
      name: name.trim() || guestProfile.name,
      ...(color ? { color } : {}),
    });
    setGuestProfileState(updated);
  }, [guestProfile.name]);

  const effectiveUserId = user?.id || guestProfile.id;
  const effectiveUserName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    guestProfile.name;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        guestProfile,
        loading,
        effectiveUserId,
        effectiveUserName,
        isAuthenticated: !!user,
        signInWithMagicLink,
        signOut,
        setNickname,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
