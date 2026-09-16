import { useQuery } from '@tanstack/react-query';
import { STUDIO_TIMEZONE, type AvailabilityDay, type DayClosedReason } from '@bmd/shared';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { formatClock } from '@/lib/datetime';
import { ApiClientError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { fetchAvailability } from '../api';

/** Why a day has nothing to offer, said plainly rather than shown as a blank grid. */
const CLOSED_MESSAGE: Record<DayClosedReason, string> = {
  CLOSED: 'The studio is closed on this day.',
  IN_THE_PAST: 'That date has passed. Choose a later one.',
  BEYOND_BOOKING_WINDOW: 'That date is further ahead than the studio takes bookings.',
  ROOM_UNAVAILABLE: 'This room is not open for booking at the moment.',
  TOO_SHORT_A_DAY: 'The studio is not open long enough that day for this session.',
};

const BLOCKED_TITLE: Record<string, string> = {
  BOOKED: 'Already booked',
  BLACKOUT: 'The studio is closed then',
  ON_AIR: 'A show is on air then',
  IN_THE_PAST: 'Already passed',
};

export function SlotPicker({
  service,
  room,
  date,
  durationMinutes,
  selectedStart,
  onSelect,
}: {
  service: string;
  room: string;
  /** `YYYY-MM-DD` in the studio's timezone. */
  date: string;
  durationMinutes: number;
  selectedStart: string | null;
  onSelect: (startsAt: string) => void;
}) {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['availability', service, room, date, durationMinutes],
    queryFn: () => fetchAvailability({ service, room, date, duration: durationMinutes }),
  });

  if (isPending) return <LoadingState label="Checking what is free…" />;

  if (error) {
    return (
      <ErrorState
        title="Times could not be loaded"
        message={error instanceof ApiClientError ? error.message : 'Availability is unavailable.'}
        requestId={error instanceof ApiClientError ? error.requestId : undefined}
        onRetry={() => void refetch()}
      />
    );
  }

  return <SlotGrid day={data} selectedStart={selectedStart} onSelect={onSelect} />;
}

function SlotGrid({
  day,
  selectedStart,
  onSelect,
}: {
  day: AvailabilityDay;
  selectedStart: string | null;
  onSelect: (startsAt: string) => void;
}) {
  if (!day.isOpen) {
    return (
      <p className="rounded-card border border-dashed border-ink-200 px-5 py-8 text-center text-sm text-ink-600">
        {CLOSED_MESSAGE[day.closedReason ?? 'CLOSED']}
      </p>
    );
  }

  const free = day.slots.filter((slot) => slot.available);

  if (free.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-ink-200 px-5 py-8 text-center text-sm text-ink-600">
        Every time on this day is taken. Try another date.
      </p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {day.slots.map((slot) => {
          const selected = slot.startsAt === selectedStart;
          return (
            <li key={slot.startsAt}>
              <button
                type="button"
                disabled={!slot.available}
                aria-pressed={selected}
                title={slot.blockedBy ? BLOCKED_TITLE[slot.blockedBy] : undefined}
                onClick={() => onSelect(slot.startsAt)}
                className={cn(
                  'w-full rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors',
                  selected
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : slot.available
                      ? 'border-ink-200 bg-white text-ink-900 hover:border-brand-600'
                      : 'cursor-not-allowed border-ink-100 bg-ink-50 text-ink-400 line-through',
                )}
              >
                {formatClock(slot.startsAt, STUDIO_TIMEZONE)}
                {!slot.available && (
                  <span className="sr-only">
                    {` — ${BLOCKED_TITLE[slot.blockedBy ?? 'BOOKED'] ?? 'Unavailable'}`}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-ink-500">
        {free.length} of {day.slots.length} start times are free. All times are studio time
        (Nairobi).
      </p>
    </>
  );
}
