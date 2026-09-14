import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Globe,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Radio,
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react';
import { OnAirIndicator } from '@/features/broadcast/OnAirIndicator';
import { UNREAD_COUNT_QUERY_KEY, fetchUnreadCount } from '@/features/account/api';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  showUnread?: boolean;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'My studio',
    items: [
      { to: '/account', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/account/bookings', label: 'Bookings', icon: CalendarDays },
      { to: '/account/rentals', label: 'Equipment hire', icon: Package },
      { to: '/account/payments', label: 'Payments', icon: CreditCard },
      { to: '/account/deliverables', label: 'Deliverables', icon: Images },
      { to: '/account/notifications', label: 'Notifications', icon: Bell, showUnread: true },
    ],
  },
  {
    label: 'Account',
    items: [{ to: '/account/settings', label: 'Profile & security', icon: Settings }],
  },
];

function Sidebar({ unread, onNavigate }: { unread: number; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-ink-950 text-white">
      <div className="flex h-16 shrink-0 items-center border-b border-ink-800 px-6">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5"
          aria-label="B.M.D Studio home"
        >
          <span className="grid size-9 place-items-center rounded-full bg-brand-600">
            <Radio aria-hidden className="size-5" />
          </span>
          <span className="font-display text-xl font-bold uppercase tracking-wide">
            B.M.D <span className="text-brand-500">Studio</span>
          </span>
        </Link>
      </div>

      <nav aria-label="Account" className="flex-1 space-y-8 overflow-y-auto px-4 py-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">
              {group.label}
            </p>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                        isActive
                          ? 'bg-brand-600 text-white'
                          : 'text-ink-300 hover:bg-ink-800 hover:text-white',
                      )
                    }
                  >
                    <item.icon aria-hidden className="size-5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.showUnread && unread > 0 && (
                      <>
                        <span
                          aria-hidden
                          className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-brand-700"
                        >
                          {unread > 99 ? '99+' : unread}
                        </span>
                        {/* The separator keeps screen readers from running the words together. */}
                        <span className="sr-only">{`, ${unread} unread`}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-ink-800 p-4">
        <Link
          to="/book"
          onClick={onNavigate}
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-brand-600 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <Plus aria-hidden className="size-4" />
          Book a session
        </Link>
        <Link
          to="/"
          onClick={onNavigate}
          className="flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold text-ink-300 transition-colors hover:text-white"
        >
          <Globe aria-hidden className="size-4" />
          Back to website
        </Link>
      </div>
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) return null;
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    navigate('/', { replace: true });
  }

  const itemClass =
    'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-ink-50';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-ink-100 sm:pr-3"
      >
        <span
          aria-hidden
          className="grid size-9 place-items-center rounded-full bg-ink-950 text-sm font-bold text-white"
        >
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight text-ink-950">
            {user.firstName} {user.lastName}
          </span>
          <span className="block text-xs leading-tight text-ink-500">{user.email}</span>
        </span>
        <ChevronDown aria-hidden className="hidden size-4 text-ink-500 sm:block" />
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-card border border-ink-200 bg-white py-1 shadow-xl">
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink-950">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>
          <Link
            to="/account/settings"
            onClick={() => setOpen(false)}
            className={cn(itemClass, 'text-ink-900')}
          >
            <Settings aria-hidden className="size-4" />
            Profile & security
          </Link>
          <Link to="/" onClick={() => setOpen(false)} className={cn(itemClass, 'text-ink-900')}>
            <Globe aria-hidden className="size-4" />
            Back to website
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className={cn(itemClass, 'border-t border-ink-100 text-brand-700')}
          >
            <LogOut aria-hidden className="size-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The signed-in customer area: a black sidebar with the account sections, and a
 * header carrying the ON AIR light, notifications and the account menu. Below
 * `lg` the sidebar becomes a drawer.
 */
export function AccountLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { data: unread = 0 } = useQuery({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!menuOpen) return undefined;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-dvh bg-ink-50">
      <a
        href="#account-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-ink-950 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
        <Sidebar unread={unread} />
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Account menu"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={closeMenu}
            className="absolute inset-0 size-full cursor-default bg-ink-950/60"
          />
          <div className="relative h-full w-72 max-w-[85%] shadow-2xl">
            <Sidebar unread={unread} onNavigate={closeMenu} />
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMenu}
              aria-label="Close menu"
              className="absolute right-3 top-3 grid size-10 place-items-center rounded-lg text-white transition-colors hover:bg-ink-800"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="grid size-10 place-items-center rounded-lg text-ink-700 transition-colors hover:bg-ink-100 lg:hidden"
          >
            <Menu aria-hidden className="size-6" />
          </button>
          <p className="font-display text-lg font-bold uppercase tracking-wide text-ink-950">
            My account
          </p>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <OnAirIndicator />
            <Link
              to="/account/notifications"
              className="relative grid size-10 place-items-center rounded-full text-ink-700 transition-colors hover:bg-ink-100"
            >
              <Bell aria-hidden className="size-5" />
              <span className="sr-only">
                {unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              </span>
              {unread > 0 && (
                <span
                  aria-hidden
                  className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-4 text-white"
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <UserMenu />
          </div>
        </header>

        <main id="account-main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
