import { NavLink, Outlet } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { OnAirIndicator } from '@/features/broadcast/OnAirIndicator';
import { cn } from '@/lib/cn';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/equipment', label: 'Equipment' },
  { to: '/shows', label: 'Shows' },
  { to: '/live', label: 'Live' },
  { to: '/gallery', label: 'Gallery' },
];

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-navy-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <NavLink to="/" className="flex items-center gap-2.5" aria-label="B.M.D Studio home">
            <span className="grid size-9 place-items-center rounded-lg bg-navy-900 text-white">
              <Radio aria-hidden className="size-5" />
            </span>
            <span className="font-display text-xl font-bold uppercase tracking-wide text-navy-900">
              B.M.D <span className="text-onair-500">Studio</span>
            </span>
          </NavLink>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-navy-50 text-navy-900'
                      : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <OnAirIndicator />
            {/* Authentication lands in Phase 3; no fake session UI before then. */}
            <NavLink
              to="/book"
              className="rounded-lg bg-signal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-signal-700"
            >
              Book a session
            </NavLink>
          </div>
        </div>

        <nav
          aria-label="Primary mobile"
          className="flex gap-1 overflow-x-auto border-t border-navy-100 px-4 py-2 md:hidden"
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium',
                  isActive ? 'bg-navy-50 text-navy-900' : 'text-navy-600',
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

      <footer className="border-t border-navy-100 bg-navy-950 text-navy-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm sm:px-6 lg:px-8">
          <p className="font-display text-lg font-bold uppercase tracking-wide text-white">
            B.M.D Studio
          </p>
          <p className="max-w-xl text-navy-300">
            Radio broadcasting, podcast production, photography, video production and livestream
            production. Nairobi, Kenya.
          </p>
          <p className="mt-4 text-xs text-navy-400">
            &copy; {new Date().getFullYear()} B.M.D Studio. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
