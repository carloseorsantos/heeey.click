import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getGuestProfile, updateGuestProfile, resetGuestProfile, GuestProfile, claimLocalBoardsForUser } from '../lib/storage';
import { t } from '../i18n';
import { trackSignIn, resetAnalytics } from '../lib/analytics';

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

  // Sync custom user nickname or color when session changes
  const applyUserCustomization = useCallback((currentUser: User | null) => {
    if (!currentUser) return;
    try {
      const storedName = localStorage.getItem(`heeey_nickname_${currentUser.id}`) || currentUser.user_metadata?.custom_name;
      const storedColorRaw = localStorage.getItem(`heeey_color_${currentUser.id}`) || (currentUser.user_metadata?.cursor_color ? JSON.stringify(currentUser.user_metadata.cursor_color) : null);
      
      const updates: Partial<GuestProfile> = {};
      if (storedName) {
        updates.name = storedName;
      }
      if (storedColorRaw) {
        try {
          updates.color = JSON.parse(storedColorRaw);
        } catch {}
      }
      if (Object.keys(updates).length > 0) {
        setGuestProfileState((prev) => updateGuestProfile({ ...prev, ...updates }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        applyUserCustomization(currentUser);
      }
      setLoading(false);
    }).catch((err) => {
      console.warn('Erro ao obter sessão do Supabase:', err);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // Only claim boards on a deliberate SIGNED_IN event for boards created by the active guest session
      if (event === 'SIGNED_IN' && currentUser?.id) {
        claimLocalBoardsForUser(currentUser.id, guestProfile.id);
        trackSignIn(currentUser);
      }
      if (currentUser) {
        applyUserCustomization(currentUser);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [applyUserCustomization, guestProfile.id]);

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
    resetAnalytics();
    setUser(null);
    setSession(null);
    // Reset guest profile to generate a fresh identity on shared devices
    const freshGuest = resetGuestProfile();
    setGuestProfileState(freshGuest);
  }, []);

  const setNickname = useCallback((name: string, color?: { background: string; stroke: string }) => {
    const trimmed = name.trim();
    if (user?.id) {
      try {
        if (trimmed) {
          localStorage.setItem(`heeey_nickname_${user.id}`, trimmed);
        }
        if (color) {
          localStorage.setItem(`heeey_color_${user.id}`, JSON.stringify(color));
        }
      } catch {}

      // Persist in Supabase auth user metadata
      supabase.auth.updateUser({
        data: {
          custom_name: trimmed || user.user_metadata?.custom_name,
          cursor_color: color || user.user_metadata?.cursor_color,
        },
      }).catch((err) => {
        console.warn('Erro ao atualizar metadata do usuário no Supabase:', err);
      });
    }

    const updated = updateGuestProfile({
      name: trimmed || guestProfile.name,
      ...(color ? { color } : {}),
    });
    setGuestProfileState(updated);
  }, [guestProfile.name, user]);

  const effectiveUserId = user?.id || guestProfile.id;

  // Custom nickname precedence:
  // 1. Authenticated user's custom nickname (localStorage or Supabase user_metadata)
  // 2. User full name from auth provider
  // 3. User customized guest profile name (if marked customized)
  // 4. User email prefix
  // 5. Fallback guest profile name
  const customUserNickname = user
    ? (user.user_metadata?.custom_name ||
       (typeof localStorage !== 'undefined' ? localStorage.getItem(`heeey_nickname_${user.id}`) : null))
    : null;

  const isGuestCustomized = typeof localStorage !== 'undefined' && localStorage.getItem('heeey_guest_customized') === 'true';

  const effectiveUserName =
    customUserNickname ||
    user?.user_metadata?.full_name ||
    (isGuestCustomized ? guestProfile.name : null) ||
    user?.email?.split('@')[0] ||
    guestProfile.name ||
    t('common.collaborator');

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
