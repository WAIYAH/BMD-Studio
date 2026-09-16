import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import type { DashboardRental } from '@bmd/shared';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '../format';
import { NON_BILLABLE_RENTAL, RENTAL_STATUS, type StatusLabel } from '../labels';
import { AmountSummary } from './AmountSummary';

export function RentalListItem({ rental }: { rental: DashboardRental }) {
  const status: StatusLabel = rental.isOverdue
    ? { label: 'Overdue', tone: 'warning' }
    : RENTAL_STATUS[rental.status];

  return (
    <Link to={`/account/rentals/${rental.id}`} className="block transition-colors hover:bg-ink-50">
      <article
        aria-label={`Hire ${rental.reference}`}
        className="flex items-center gap-4 px-5 py-4"
      >
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"
        >
          <Package className="size-6" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink-950">
              {rental.items.length > 0 ? rental.items.join(', ') : 'Equipment hire'}
            </p>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
          <p className="mt-0.5 text-sm text-ink-600">
            {formatDate(rental.startsAt)} – {formatDate(rental.endsAt)}
          </p>
          <p className="mt-0.5 font-mono text-xs text-ink-500">{rental.reference}</p>
        </div>

        <AmountSummary
          totalCents={rental.totalCents}
          paidCents={rental.paidCents}
          billable={!NON_BILLABLE_RENTAL.has(rental.status)}
        />
      </article>
    </Link>
  );
}
