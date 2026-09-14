import { Link } from 'react-router-dom';
import { ArrowRight, Images } from 'lucide-react';
import type { DashboardDeliverable } from '@bmd/shared';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/cn';
import { formatDate } from '../format';

export function DeliverableListItem({ deliverable }: { deliverable: DashboardDeliverable }) {
  const delivered = deliverable.deliveredAt !== null;
  const late =
    !delivered && deliverable.dueAt !== null && new Date(deliverable.dueAt).getTime() < Date.now();

  const timing = deliverable.deliveredAt
    ? `Delivered ${formatDate(deliverable.deliveredAt)}`
    : deliverable.dueAt
      ? `Due ${formatDate(deliverable.dueAt)}`
      : 'In production';

  return (
    <article aria-label={deliverable.title} className="flex flex-wrap items-center gap-4 px-5 py-4">
      <span
        aria-hidden
        className={cn(
          'grid size-12 shrink-0 place-items-center rounded-lg',
          delivered ? 'bg-ink-950 text-white' : 'bg-brand-50 text-brand-600',
        )}
      >
        <Images className="size-6" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink-950">{deliverable.title}</p>
        <p className="mt-0.5 text-sm text-ink-600">{timing}</p>
        <p className="mt-0.5 font-mono text-xs text-ink-500">
          Booking {deliverable.bookingReference}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <StatusBadge tone={delivered ? 'success' : late ? 'warning' : 'info'}>
          {delivered ? 'Ready' : late ? 'Running late' : 'In progress'}
        </StatusBadge>
        {deliverable.gallerySlug && (
          <Link
            to={`/gallery/${deliverable.gallerySlug}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            Open gallery
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
    </article>
  );
}
