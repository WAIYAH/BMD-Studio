import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, Plus } from 'lucide-react';
import type { AccountBookingScope } from '@bmd/shared';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { fetchBookings } from '@/features/account/api';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { BookingListItem } from '@/features/account/components/BookingListItem';
import { Pagination } from '@/features/account/components/Pagination';
import { PanelEmpty } from '@/features/account/components/Panel';
import { ToggleGroup } from '@/features/account/components/ToggleGroup';
import { pageParam } from '@/features/account/format';
import { ApiClientError } from '@/lib/api-client';

export function AccountBookingsPage() {
  const [params, setParams] = useSearchParams();
  const scope: AccountBookingScope = params.get('scope') === 'past' ? 'past' : 'upcoming';
  const page = pageParam(params.get('page'));

  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['me', 'bookings', scope, page],
    queryFn: () => fetchBookings(scope, page),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title="Bookings"
        description="Your studio sessions, with their status and what has been paid."
        actions={
          <ButtonLink to="/book" icon={<Plus aria-hidden className="size-4" />}>
            Book a session
          </ButtonLink>
        }
      />

      <ToggleGroup
        label="Which bookings"
        value={scope}
        options={[
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'past', label: 'Past & cancelled' },
        ]}
        onChange={(next) => setParams({ scope: next })}
      />

      <div className="rounded-card border border-ink-200 bg-white">
        {isPending ? (
          <LoadingState label="Loading bookings…" />
        ) : error ? (
          <div className="p-5">
            <ErrorState
              title="Bookings could not be loaded"
              message={
                error instanceof ApiClientError ? error.message : 'Your bookings are unavailable.'
              }
              requestId={error instanceof ApiClientError ? error.requestId : undefined}
              onRetry={() => void refetch()}
            />
          </div>
        ) : data.items.length === 0 ? (
          <PanelEmpty
            icon={CalendarDays}
            title={scope === 'upcoming' ? 'No upcoming sessions' : 'No past bookings'}
            description={
              scope === 'upcoming'
                ? 'When you book a studio session, it will show here.'
                : 'Sessions you have had, or cancelled, will show here.'
            }
            action={
              scope === 'upcoming' ? { to: '/services', label: 'Browse services' } : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-ink-100">
              {data.items.map((booking) => (
                <li key={booking.id}>
                  <BookingListItem booking={booking} />
                </li>
              ))}
            </ul>
            <Pagination
              meta={data.meta}
              onPageChange={(next) => setParams({ scope, page: String(next) })}
            />
          </>
        )}
      </div>
    </div>
  );
}
