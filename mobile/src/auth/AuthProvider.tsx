import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import type { TokenResponse } from '@/api/auth';
import { getMe, type Me } from '@/api/me';
import { session } from '@/auth/session';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  /** The rider's profile; null while signed out or if it could not be loaded */
  me: Me | null;
  /** Stores the tokens from a successful code verification and loads the profile. */
  signIn: (tokens: TokenResponse) => Promise<void>;
  signOut: () => Promise<void>;
  /** Loads the profile again (e.g. after a network error). */
  reloadMe: () => Promise<void>;
  /** Replaces the profile after an update. */
  setMe: (me: Me) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}

/** Profile, or null when it can't be loaded right now (offline). A rejected session signs out by itself. */
async function loadMe(): Promise<Me | null> {
  try {
    return await getMe();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    // The session tells us when it ends (sign-out, or a refresh the backend rejected)
    const unsubscribe = session.subscribe((signedIn) => {
      if (!signedIn) {
        setMe(null);
        setStatus('signedOut');
      }
    });

    let cancelled = false;
    (async () => {
      const hasSession = await session.init().catch(() => false);
      const profile = hasSession ? await loadMe() : null;
      if (cancelled) return;
      setMe(profile);
      setStatus(session.isSignedIn ? 'signedIn' : 'signedOut');
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    status,
    me,
    signIn: async (tokens) => {
      await session.signIn(tokens);
      // Load the profile before switching screens, so a new rider goes straight to the display name
      const profile = await loadMe();
      if (!session.isSignedIn) return;
      setMe(profile);
      setStatus('signedIn');
    },
    signOut: () => session.signOut(),
    reloadMe: async () => {
      const profile = await loadMe();
      if (profile) setMe(profile);
    },
    setMe,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}
