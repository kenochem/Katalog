import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import {
  isAccountRole,
  type AccountRole,
  type AppRole,
} from './roles';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: AccountRole;
  active: boolean;
}

type AuthMode = 'loading' | 'gate' | 'guest' | 'signed_in';

interface AuthContextValue {
  mode: AuthMode;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  role: AppRole;
  displayLabel: string;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  exitGuest: () => void;
  refreshProfile: () => Promise<void>;
}

const GUEST_KEY = 'katalog-guest-session';

const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfile(row: {
  id: string;
  email: string;
  display_name: string;
  role: string;
  active: boolean;
}): UserProfile | null {
  if (!isAccountRole(row.role)) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: row.active,
  };
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, active')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('profiles fetch', error);
    return null;
  }
  if (!data) return null;
  return mapProfile(data);
}

function readGuestFlag(): boolean {
  try {
    return sessionStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
}

function writeGuestFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(GUEST_KEY, '1');
    else sessionStorage.removeItem(GUEST_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next);
    setAuthError(null);
    if (!next?.user) {
      setProfile(null);
      if (readGuestFlag()) setMode('guest');
      else setMode('gate');
      return;
    }
    writeGuestFlag(false);
    const p = await fetchProfile(next.user.id);
    if (!p || !p.active) {
      setProfile(null);
      setAuthError(
        !p
          ? 'Brak profilu — poproś admina o dostęp.'
          : 'Konto wyłączone. Skontaktuj się z administratorem.',
      );
      if (supabase) await supabase.auth.signOut();
      setSession(null);
      setMode('gate');
      return;
    }
    setProfile(p);
    setMode('signed_in');
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Bez Supabase — tryb gościa (dev / offline demo)
      setMode(readGuestFlag() ? 'guest' : 'gate');
      return;
    }

    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      void applySession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      // Start obsługuje getSession — bez podwójnego apply i migania UI
      if (event === 'INITIAL_SESSION') return;
      if (event === 'TOKEN_REFRESHED') {
        setSession(next);
        return;
      }
      void applySession(next);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { error: 'Supabase nie jest skonfigurowane (.env).' };
    }
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      const msg =
        error.message.includes('Invalid login')
          ? 'Nieprawidłowy email lub hasło.'
          : error.message;
      setAuthError(msg);
      return { error: msg };
    }
    writeGuestFlag(false);
    return {};
  }, []);

  const signOut = useCallback(async () => {
    writeGuestFlag(false);
    setProfile(null);
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setMode('gate');
  }, []);

  const continueAsGuest = useCallback(() => {
    writeGuestFlag(true);
    setProfile(null);
    setSession(null);
    setAuthError(null);
    setMode('guest');
  }, []);

  const exitGuest = useCallback(() => {
    writeGuestFlag(false);
    setMode('gate');
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const p = await fetchProfile(session.user.id);
    setProfile(p);
  }, [session]);

  const role: AppRole =
    mode === 'guest' ? 'guest' : profile?.role ?? 'guest';

  const displayLabel =
    mode === 'guest'
      ? 'Gość'
      : profile?.displayName || profile?.email || 'Konto';

  const value = useMemo<AuthContextValue>(
    () => ({
      mode,
      session,
      user: session?.user ?? null,
      profile,
      role,
      displayLabel,
      authError,
      signIn,
      signOut,
      continueAsGuest,
      exitGuest,
      refreshProfile,
    }),
    [
      mode,
      session,
      profile,
      role,
      displayLabel,
      authError,
      signIn,
      signOut,
      continueAsGuest,
      exitGuest,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth poza AuthProvider');
  return ctx;
}
