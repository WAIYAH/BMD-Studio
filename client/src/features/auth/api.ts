import type { AuthSession, LoginData, RegisterData } from '@bmd/shared';
import { api, setAccessToken } from '@/lib/api-client';

export async function login(credentials: LoginData): Promise<AuthSession> {
  const session = await api.post<AuthSession>('/auth/login', credentials);
  setAccessToken(session.accessToken);
  return session;
}

export async function register(details: RegisterData): Promise<AuthSession> {
  const session = await api.post<AuthSession>('/auth/register', details);
  setAccessToken(session.accessToken);
  return session;
}

/** Ends the session on the server. The local token is dropped even if that request fails. */
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}
