import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  CreditCard,
  Images,
  MapPin,
  Package,
  Plus,
  Radio,
  Receipt,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { CustomerDashboard } from '@bmd/shared';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { fetchDashboard } from '@/features/account/api';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { BookingListItem } from '@/features/account/components/BookingListItem';
import { DeliverableListItem } from '@/features/account/components/DeliverableListItem';
import { NotificationListItem } from '@/features/account/components/NotificationListItem';
import { Panel, PanelEmpty } from '@/features/account/components/Panel';
import { PaymentsTable } from '@/features/account/components/PaymentsTable';
import { RentalListItem } from '@/features/account/components/RentalListItem';
import { StatCard } from '@/features/account/components/StatCard';
import { shillings } from '@/features/account/format';
import { useAuth } from '@/features/auth/auth-context';
import { ApiClientError } from '@/lib/api-client';

const QUICK_LINKS: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/book', label: 'Book a session', icon: Plus },
  { to: '/equipment', label: 'Hire equipment', icon: Package },
  { to: '/live', label: 'Watch live', icon: Radio },
  { to: '/visit', label: 'Visit the studio', icon: MapPin },
];

export function AccountOverviewPage() {
  const { user } = useAuth();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['me', 'dashboard'],
    queryFn: fetchDashboard,
  });
  const firstName = data?.profile.firstName ?? user?.firstName ?? '';

  return (
    <div className="space-y-8">
      <AccountPageHeader
        title={firstName ? `Hello, ${firstName}` : 'Your account'}
        documentTitle="My account"
        description="Everything happening with your studio sessions, hires and payments."
        actions={
          <>
            <ButtonLink to="/book" icon={<Plus aria-hidden className="size-4" />}>
              Book a session
            </ButtonLink>
            <ButtonLink to="/equipment" variant="secondary">
              Hire equipment
            </ButtonLink>
          </>
        }
      />

      {isPending ? (
        <LoadingState label="Loading your account…" />
      ) : error ? (
        <ErrorState
          title="Your account could not be loaded"
          message={
            error instanceof ApiClientError ? error.message : 'Your dashboard is unavailable.'
          }
          requestId={error instanceof ApiClientError ? error.requestId : undefined}
          onRetry={() => void refetch()}
        />
      ) : (
        <DashboardContent dashboard={data} />
      )}
    </div>
  );
}

function DashboardContent({ dashboard }: { dashboard: CustomerDashboard }) {
  const { stats } = dashboard;
  const owing = stats.balanceDueCents > 0;

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li>
          <StatCard
            label="Upcoming sessions"
            value={String(stats.upcomingBookings)}
            icon={CalendarDays}
          />
        </li>
        <li>
          <StatCard label="Equipment on hire" value={String(stats.activeRentals)} icon={Package} />
        </li>
        <li>
          <StatCard
            label="Balance due"
            value={shillings(stats.balanceDueCents)}
            icon={Wallet}
            emphasis={owing}
            hint={owing ? 'Across your bookings and hires' : 'You’re all paid up'}
          />
        </li>
        <li>
          <StatCard label="Total paid" value={shillings(stats.totalPaidCents)} icon={Receipt} />
        </li>
      </ul>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Upcoming sessions"
          action={{ to: '/account/bookings', label: 'All bookings' }}
          className="xl:col-span-2"
        >
          {dashboard.upcomingBookings.length === 0 ? (
            <PanelEmpty
              icon={CalendarDays}
              title="No upcoming sessions"
              description="When you book a studio session, it will show here."
              action={{ to: '/services', label: 'Browse services' }}
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {dashboard.upcomingBookings.map((booking) => (
                <li key={booking.id}>
                  <BookingListItem booking={booking} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Notifications" action={{ to: '/account/notifications', label: 'View all' }}>
          {dashboard.notifications.length === 0 ? (
            <PanelEmpty
              icon={Bell}
              title="You’re all caught up"
              description="Messages from the studio will show here."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {dashboard.notifications.map((notification) => (
                <li key={notification.id}>
                  <NotificationListItem notification={notification} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Equipment on hire"
          action={{ to: '/account/rentals', label: 'All hires' }}
          className="xl:col-span-2"
        >
          {dashboard.activeRentals.length === 0 ? (
            <PanelEmpty
              icon={Package}
              title="No equipment on hire"
              description="Equipment you hire from the studio will show here."
              action={{ to: '/equipment', label: 'Browse equipment' }}
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {dashboard.activeRentals.map((rental) => (
                <li key={rental.id}>
                  <RentalListItem rental={rental} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Quick links">
          <ul className="grid grid-cols-2 gap-3 p-5">
            {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex h-full flex-col items-start gap-3 rounded-lg border border-ink-200 p-4 text-sm font-semibold text-ink-950 transition-colors hover:border-brand-600"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-brand-600 text-white">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Recent payments"
          action={{ to: '/account/payments', label: 'All payments' }}
          className="xl:col-span-2"
        >
          {dashboard.recentPayments.length === 0 ? (
            <PanelEmpty
              icon={CreditCard}
              title="No payments yet"
              description="Payments for your bookings and hires will show here, with receipts."
            />
          ) : (
            <PaymentsTable payments={dashboard.recentPayments} caption="Recent payments" />
          )}
        </Panel>

        <Panel title="Deliverables" action={{ to: '/account/deliverables', label: 'View all' }}>
          {dashboard.deliverables.length === 0 ? (
            <PanelEmpty
              icon={Images}
              title="Nothing to collect yet"
              description="Photos, recordings and edits from your sessions will show here."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {dashboard.deliverables.map((deliverable) => (
                <li key={deliverable.id}>
                  <DeliverableListItem deliverable={deliverable} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
