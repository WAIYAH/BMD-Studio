import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Radio, UserRound } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-context';
import { OnAirIndicator } from '@/features/broadcast/OnAirIndicator';
import { LEGAL_PAGES } from '@/features/legal/entity';
import { cn } from '@/lib/cn';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/equipment', label: 'Equipment' },
  { to: '/shows', label: 'Shows' },
  { to: '/live', label: 'Live' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/visit', label: 'Visit us' },
];

/**
 * Sign in, or the way back to the account once signed in. Nothing is shown
 * while the session is still being checked, so the header never flickers
 * between the two.
 */
function AccountEntry() {
  const { status, user } = useAuth();

  if (status === 'authenticated' && user) {
    const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    return (
      <Link
        to="/account"
        className="flex items-center gap-2 rounded-full border border-ink-200 p-1 text-sm font-semibold text-ink-950 transition-colors hover:bg-ink-50 sm:pr-3"
      >
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full bg-ink-950 text-xs font-bold text-white"
        >
          {initials}
        </span>
        <span className="sr-only sm:not-sr-only">My account</span>
      </Link>
    );
  }

  if (status === 'anonymous') {
    return (
      <Link
        to="/login"
        className="flex items-center gap-1.5 rounded-full px-2 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-ink-100 sm:px-3"
      >
        <UserRound aria-hidden className="size-5" />
        <span className="sr-only sm:not-sr-only">Sign in</span>
      </Link>
    );
  }

  return null;
}

/** A new page opens at the top; in-page `#section` links keep their own scrolling. */
function useScrollToTopOnNavigate(): void {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);
}

export function PublicLayout() {
  useScrollToTopOnNavigate();

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink-950 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/95 backdrop-blur">
        <div aria-hidden className="h-1 bg-brand-600" />
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5" aria-label="B.M.D Studio home">
            <span className="grid size-9 place-items-center rounded-full bg-brand-600 text-white">
              <Radio aria-hidden className="size-5" />
            </span>
            <span className="font-display text-xl font-bold uppercase tracking-wide text-ink-950">
              B.M.D <span className="text-brand-600">Studio</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-3 py-2 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-700 hover:bg-ink-100 hover:text-ink-950',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <OnAirIndicator />
            <AccountEntry />
            <Link
              to="/book"
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Book a session
            </Link>
          </div>
        </div>

        <nav
          aria-label="Primary mobile"
          className="flex gap-1 overflow-x-auto border-t border-ink-100 px-4 py-2 lg:hidden"
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t-4 border-brand-600 bg-ink-950 text-ink-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
          <div>
            <p className="font-display text-2xl font-bold uppercase tracking-wide text-white">
              B.M.D <span className="text-brand-500">Studio</span>
            </p>
            <p className="mt-3 max-w-sm text-sm">
              Radio broadcasting, podcast production, photography, video and livestream production
              in Nairobi, Kenya.
            </p>
          </div>

          <nav aria-label="Footer">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-white">
              Explore
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {NAV.filter((item) => item.to !== '/').map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-white">
              Get started
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/book" className="transition-colors hover:text-white">
                  Book a session
                </Link>
              </li>
              <li>
                <Link to="/visit" className="transition-colors hover:text-white">
                  Opening hours &amp; location
                </Link>
              </li>
              <li>
                <Link to="/live" className="transition-colors hover:text-white">
                  Watch live
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-ink-800">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>&copy; {new Date().getFullYear()} B.M.D Studio. All rights reserved.</p>
            <nav aria-label="Legal">
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {LEGAL_PAGES.map((page) => (
                  <li key={page.to}>
                    <Link to={page.to} className="transition-colors hover:text-white">
                      {page.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
