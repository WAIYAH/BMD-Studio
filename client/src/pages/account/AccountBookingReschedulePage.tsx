import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { STUDIO_TIMEZONE, type BookingDetail, type PublicServiceCategory } from '@bmd/shared';
import { Button } from '@/components/ui/Button';
import { FormAlert } from '@/components/ui/Field';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { formatDate, formatDateTime } from '@/features/account/format';
import { fetchBooking, rescheduleBooking } from '@/features/booking/api';
import { SlotPicker } from '@/features/booking/components/SlotPicker';
import { fetchServiceCatalogue } from '@/features/catalogue/api';
import { ApiClientError } from '@/lib/api-client';
import { formatClockRange, zonedDateKey } from '@/lib/datetime';

/**
 * Moving a booking to another time. The same slot picker the booking flow uses,
 * with the service, length and package already fixed by the original booking.
 */
export function AccountBookingReschedulePage() {
  const { id = '' } = useParams();
  const booking = useQuery({
    queryKey: ['me', 'bookings', 'detail', id],
    queryFn: () => fetchBooking(id),
  });
  const catalogue = useQuery({
    queryKey: ['catalogue', 'services'],
    queryFn: fetchServiceCatalogue,
  });

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title="Move this session"
        documentTitle="Move a booking"
        description="Pick a new time. The price is worked out again when you confirm."
      />

      {booking.isPending || catalogue.isPending ? (
        <LoadingState label="Loading your booking…" />
      ) : booking.error ? (
        <ErrorState
          title="This booking could not be loaded"
          message={
            booking.error instanceof ApiClientError
              ? booking.error.message
              : 'The booking is unavailable.'
          }
          onRetry={() => void booking.refetch()}
        />
      ) : (
        <RescheduleForm booking={booking.data} catalogue={catalogue.data ?? []} />
      )}
    </div>
  );
}

function RescheduleForm({
  booking,
  catalogue,
}: {
  booking: BookingDetail;
  catalogue: PublicServiceCategory[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const service = catalogue
    .flatMap((category) => category.services)
    .find((entry) => entry.slug === booking.serviceSlug);

  const [room, setRoom] = useState(booking.roomSlug);
  const [date, setDate] = useState(zonedDateKey(booking.startsAt, STUDIO_TIMEZONE));
  const [startsAt, setStartsAt] = useState<string | null>(null);

  const move = useMutation({
    mutationFn: (start: string) =>
      rescheduleBooking(booking.id, {
        room,
        startsAt: start,
        durationMinutes: booking.durationMinutes,
      }),
    onSuccess: (moved) => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate(`/account/bookings/${moved.id}`, { replace: true });
    },
  });

  if (!booking.reschedule.allowed) {
    return (
      <div className="space-y-4">
        <FormAlert>{booking.reschedule.reason ?? 'This booking can no longer be moved.'}</FormAlert>
        <Link
          to={`/account/bookings/${booking.id}`}
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          Back to the booking
        </Link>
      </div>
    );
  }

  // Falling back to the booking's own room keeps the picker usable even if the
  // catalogue could not be loaded.
  const rooms: Array<{ slug: string; name: string }> = service?.rooms ?? [
    { slug: booking.roomSlug, name: booking.roomName },
  ];

  return (
    <div className="space-y-6">
      <p className="rounded-card border border-ink-200 bg-ink-50 px-5 py-4 text-sm text-ink-700">
        Currently {formatDate(booking.startsAt)},{' '}
        {formatClockRange(booking.startsAt, booking.endsAt, STUDIO_TIMEZONE)} in {booking.roomName}.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink-900">
          Room
          <select
            value={room}
            onChange={(event) => {
              setRoom(event.target.value);
              setStartsAt(null);
            }}
            className="mt-1.5 h-11 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm font-normal text-ink-950"
          >
            {rooms.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-ink-900">
          Date
          <input
            type="date"
            value={date}
            min={zonedDateKey(new Date().toISOString(), STUDIO_TIMEZONE)}
            onChange={(event) => {
              setDate(event.target.value);
              setStartsAt(null);
            }}
            className="mt-1.5 h-11 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm font-normal text-ink-950"
          />
        </label>
      </div>

      <SlotPicker
        service={booking.serviceSlug}
        room={room}
        date={date}
        durationMinutes={booking.durationMinutes}
        selectedStart={startsAt}
        onSelect={setStartsAt}
      />

      {move.error && (
        <FormAlert>
          {move.error instanceof ApiClientError
            ? move.error.message
            : 'The booking could not be moved.'}
        </FormAlert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          disabled={!startsAt}
          loading={move.isPending}
          onClick={() => startsAt && move.mutate(startsAt)}
        >
          {startsAt ? `Move to ${formatDateTime(startsAt)}` : 'Choose a new time'}
        </Button>
        <Link
          to={`/account/bookings/${booking.id}`}
          className="text-sm font-semibold text-ink-600 hover:text-ink-950"
        >
          Keep the current time
        </Link>
      </div>
    </div>
  );
}
