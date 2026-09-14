import { createContext, useContext } from 'react';
import type { AuthUser, LoginData, RegisterData } from '@bmd/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  /** `loading` until the stored session has been checked on page load. */
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (credentials: LoginData) => Promise<AuthUser>;
  signUp: (details: RegisterData) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  /** Replaces the cached profile after the customer edits it. */
  setUser: (user: AuthUser) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
