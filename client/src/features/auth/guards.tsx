import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from '@/components/ui/States';
import { safeRedirect } from '@/lib/forms';
import { useAuth } from './auth-context';

/**
 * Signed-in visitors only; everyone else is sent to sign in and brought back
 * afterwards. This is convenience, not security — the API authorises every
 * request on its own.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-50">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  if (status === 'anonymous') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  return <>{children}</>;
}

/** Sign-in and sign-up pages send an already signed-in visitor on to where they were going. */
export function GuestOnly() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'authenticated') {
    const from = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={safeRedirect(from)} replace />;
  }

  return <Outlet />;
}
