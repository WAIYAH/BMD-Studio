import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthSession, AuthUser, LoginData, RegisterData } from '@bmd/shared';
import { refreshSession, setSessionListener } from '@/lib/api-client';
import * as authApi from './api';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';

/** Renew this long before the access token lapses, so requests rarely meet an expired one. */
const RENEW_AHEAD_SECONDS = 60;

/**
 * Owns the signed-in session. The access token lives only in memory, so on
 * every page load the session is restored from the httpOnly refresh cookie,
 * then renewed shortly before each token expires.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);
  const userIdRef = useRef<string | null>(null);

  const applySession = useCallback(
    (next: AuthSession | null) => {
      const nextUserId = next?.user.id ?? null;
      if (userIdRef.current !== nextUserId) {
        // One person's cached account data must never show to the next.
        queryClient.removeQueries({ queryKey: ['me'] });
        userIdRef.current = nextUserId;
      }
      setSession(next);
      setStatus(next ? 'authenticated' : 'anonymous');
    },
    [queryClient],
  );

  useEffect(() => {
    setSessionListener(applySession);
    return () => setSessionListener(null);
  }, [applySession]);

  useEffect(() => {
    // Success and a rejected cookie both arrive through the listener; only a
    // failure to reach the server at all lands here.
    refreshSession().catch(() => applySession(null));
  }, [applySession]);

  const token = session?.accessToken;
  const expiresIn = session?.expiresIn;
  useEffect(() => {
    if (!token || !expiresIn) return undefined;
    const delay = Math.max(expiresIn - RENEW_AHEAD_SECONDS, 10) * 1000;
    const timer = window.setTimeout(() => {
      refreshSession().catch(() => undefined);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [token, expiresIn]);

  const signIn = useCallback(
    async (credentials: LoginData) => {
      const next = await authApi.login(credentials);
      applySession(next);
      return next.user;
    },
    [applySession],
  );

  const signUp = useCallback(
    async (details: RegisterData) => {
      const next = await authApi.register(details);
      applySession(next);
      return next.user;
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The session ends locally whether or not the server could be told.
    }
    applySession(null);
  }, [applySession]);

  const setUser = useCallback((user: AuthUser) => {
    setSession((current) => (current ? { ...current, user } : current));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user: session?.user ?? null, signIn, signUp, signOut, setUser }),
    [status, session, signIn, signUp, signOut, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
