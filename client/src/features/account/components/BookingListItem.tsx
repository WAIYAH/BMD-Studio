import { Link } from 'react-router-dom';
import { STUDIO_TIMEZONE, type DashboardBooking } from '@bmd/shared';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatClockRange } from '@/lib/datetime';
import { dateBlock, formatDate } from '../format';
import { BOOKING_STATUS, NON_BILLABLE_BOOKING } from '../labels';
import { AmountSummary } from './AmountSummary';

export function BookingListItem({ booking }: { booking: DashboardBooking }) {
  const block = dateBlock(booking.startsAt);
  const status = BOOKING_STATUS[booking.status];

  return (
    <Link
      to={`/account/bookings/${booking.id}`}
      className="block transition-colors hover:bg-ink-50"
    >
      <article
        aria-label={`${booking.serviceName}, ${formatDate(booking.startsAt)}`}
        className="flex items-center gap-4 px-5 py-4"
      >
        <div
          aria-hidden
          className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-ink-950 py-2 text-white"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">
            {block.weekday}
          </span>
          <span className="font-display text-3xl font-bold leading-none">{block.day}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
            {block.month}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink-950">{booking.serviceName}</p>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
          <p className="mt-0.5 text-sm text-ink-600">
            {booking.roomName} ·{' '}
            {formatClockRange(booking.startsAt, booking.endsAt, STUDIO_TIMEZONE)}
          </p>
          <p className="mt-0.5 font-mono text-xs text-ink-500">{booking.reference}</p>
        </div>

        <AmountSummary
          totalCents={booking.totalCents}
          paidCents={booking.paidCents}
          billable={!NON_BILLABLE_BOOKING.has(booking.status)}
        />
      </article>
    </Link>
  );
}
