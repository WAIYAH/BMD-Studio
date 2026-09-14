import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation, type InitialEntry } from 'react-router-dom';
import { vi } from 'vitest';
import type { AuthUser } from '@bmd/shared';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';

export const TEST_USER: AuthUser = {
  id: 'user-1',
  email: 'wanjiku@example.test',
  firstName: 'Wanjiku',
  lastName: 'Kamau',
  phone: '+254722000000',
  status: 'ACTIVE',
  emailVerified: false,
  roles: ['CUSTOMER'],
  permissions: ['booking:create'],
  createdAt: '2026-09-01T08:00:00.000Z',
};

/** A signed-in auth context whose actions are spies; override what a test needs. */
export function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'authenticated',
    user: TEST_USER,
    signIn: vi.fn().mockResolvedValue(TEST_USER),
    signUp: vi.fn().mockResolvedValue(TEST_USER),
    signOut: vi.fn().mockResolvedValue(undefined),
    setUser: vi.fn(),
    ...overrides,
  };
}

/** Renders where a test has navigated to: `pathname+search|state`. */
export function LocationDisplay() {
  const location = useLocation();
  return (
    <p data-testid="location">{`${location.pathname}${location.search}|${JSON.stringify(location.state ?? null)}`}</p>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  { auth = authValue(), route = '/' }: { auth?: AuthContextValue; route?: InitialEntry } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
