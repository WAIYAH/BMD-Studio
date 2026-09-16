import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Clock, CreditCard, Images } from 'lucide-react';
import { STUDIO_TIMEZONE, type BookingDetail } from '@bmd/shared';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { DeliverableListItem } from '@/features/account/components/DeliverableListItem';
import { PaymentsTable } from '@/features/account/components/PaymentsTable';
import { Panel, PanelEmpty } from '@/features/account/components/Panel';
import { formatDate, formatDateTime, shillings } from '@/features/account/format';
import { BOOKING_STATUS } from '@/features/account/labels';
import { cancelBooking, fetchBooking } from '@/features/booking/api';
import { ApiClientError } from '@/lib/api-client';
import { formatClockRange } from '@/lib/datetime';
import { formatMinutes } from '@/lib/format';

export function AccountBookingDetailPage() {
  const { id = '' } = useParams();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['me', 'bookings', 'detail', id],
    queryFn: () => fetchBooking(id),
  });

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title="Booking"
        documentTitle={data ? `Booking ${data.reference}` : 'Booking'}
        description="Everything about this session, and what you can still change."
      />

      {isPending ? (
        <LoadingState label="Loading your booking…" />
      ) : error ? (
        <ErrorState
          title="This booking could not be loaded"
          message={error instanceof ApiClientError ? error.message : 'The booking is unavailable.'}
          requestId={error instanceof ApiClientError ? error.requestId : undefined}
          onRetry={() => void refetch()}
        />
      ) : (
        <BookingView booking={data} />
      )}
    </div>
  );
}

function BookingView({ booking }: { booking: BookingDetail }) {
  const status = BOOKING_STATUS[booking.status];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        <p className="font-mono text-sm text-ink-500">{booking.reference}</p>
        {booking.movedFromReference && (
          <p className="text-sm text-ink-500">Moved from {booking.movedFromReference}</p>
        )}
        {booking.movedToReference && (
          <p className="text-sm text-ink-500">Moved to {booking.movedToReference}</p>
        )}
      </div>

      {booking.status === 'PENDING_PAYMENT' && booking.holdExpiresAt && (
        <p className="flex items-start gap-2 rounded-card border border-brand-200 bg-brand-50 px-5 py-4 text-sm text-brand-800">
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            This room is held until {formatDateTime(booking.holdExpiresAt)}. Online payment is not
            open yet — contact the studio to pay and confirm the session.
          </span>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Session" className="lg:col-span-2">
          <dl className="divide-y divide-ink-100">
            <Row term="Service" detail={booking.serviceName} />
            {booking.packageName && <Row term="Package" detail={booking.packageName} />}
            <Row term="Room" detail={`${booking.roomName}, ${booking.studioName}`} />
            <Row term="Date" detail={formatDate(booking.startsAt)} />
            <Row
              term="Time"
              detail={`${formatClockRange(booking.startsAt, booking.endsAt, STUDIO_TIMEZONE)} · ${formatMinutes(
                booking.durationMinutes,
              )}`}
            />
            {booking.notes && <Row term="Your notes" detail={booking.notes} />}
          </dl>
        </Panel>

        <Panel title="What it costs">
          <dl className="divide-y divide-ink-100">
            <Row term="Subtotal" detail={shillings(booking.subtotalCents)} />
            <Row term="VAT" detail={shillings(booking.taxCents)} />
            <Row term="Total" detail={shillings(booking.totalCents)} />
            <Row term="Paid" detail={shillings(booking.paidCents)} />
            <Row
              term={booking.balanceCents > 0 ? 'Still to pay' : 'Balance'}
              detail={booking.balanceCents > 0 ? shillings(booking.balanceCents) : 'Paid in full'}
            />
          </dl>
        </Panel>

        <Panel title="Payments" className="lg:col-span-2">
          {booking.payments.length === 0 ? (
            <PanelEmpty
              icon={CreditCard}
              title="No payments yet"
              description="Payments towards this session will show here, with receipts."
            />
          ) : (
            <PaymentsTable payments={booking.payments} caption="Payments for this booking" />
          )}
        </Panel>

        <Panel title="What happened">
          <ol className="space-y-4 p-5">
            {booking.history.map((event) => {
              const label = BOOKING_STATUS[event.status];
              return (
                <li key={`${event.status}-${event.at}`} className="text-sm">
                  <p className="font-semibold text-ink-950">{label.label}</p>
                  <p className="text-ink-500">{formatDateTime(event.at)}</p>
                  {event.reason && <p className="mt-0.5 text-ink-600">{event.reason}</p>}
                </li>
              );
            })}
          </ol>
        </Panel>

        {booking.deliverables.length > 0 && (
          <Panel title="Deliverables" className="lg:col-span-3">
            <ul className="divide-y divide-ink-100">
              {booking.deliverables.map((deliverable) => (
                <li key={deliverable.id}>
                  <DeliverableListItem deliverable={deliverable} />
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {booking.deliverables.length === 0 && booking.status === 'COMPLETED' && (
          <Panel title="Deliverables" className="lg:col-span-3">
            <PanelEmpty
              icon={Images}
              title="Nothing to collect yet"
              description="Photos, recordings and edits from this session will show here."
            />
          </Panel>
        )}
      </div>

      <BookingActions booking={booking} />
    </>
  );
}

function BookingActions({ booking }: { booking: BookingDetail }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');

  const cancel = useMutation({
    mutationFn: () => cancelBooking(booking.id, reason.trim() ? { reason: reason.trim() } : {}),
    onSuccess: () => {
      setDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const { cancellation, reschedule } = booking;

  if (!cancellation.allowed && !reschedule.allowed) {
    return (
      <p className="text-sm text-ink-600">
        {cancellation.reason ?? 'This booking can no longer be changed.'} Contact the studio if you
        need help.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {reschedule.allowed ? (
        <Link
          to={`/account/bookings/${booking.id}/reschedule`}
          className="inline-flex h-10 items-center justify-center rounded-full border border-ink-300 bg-white px-5 text-sm font-semibold text-ink-950 transition-colors hover:bg-ink-100"
        >
          Move to another time
        </Link>
      ) : (
        reschedule.reason && <p className="text-sm text-ink-600">{reschedule.reason}</p>
      )}

      {cancellation.allowed && (
        <Button variant="secondary" onClick={() => setDialogOpen(true)}>
          Cancel booking
        </Button>
      )}

      <Dialog
        open={dialogOpen}
        title="Cancel this booking?"
        onClose={() => setDialogOpen(false)}
        description={
          cancellation.free ? (
            <>
              This is inside the free cancellation period.
              {cancellation.refundableCents > 0 ? (
                <>
                  {' '}
                  A refund of <strong>{shillings(cancellation.refundableCents)}</strong> will be
                  requested for you, and paid back the way you paid.
                </>
              ) : (
                ' Nothing has been paid, so there is nothing to refund.'
              )}
            </>
          ) : (
            <>
              The free cancellation period has passed
              {cancellation.freeUntil
                ? ` (it ended ${formatDateTime(cancellation.freeUntil)})`
                : ''}
              , so what you have paid is not refunded. The session will be released for others.
            </>
          )
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Keep booking
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel booking
            </Button>
          </>
        }
      >
        <label className="block text-sm font-semibold text-ink-900">
          Reason (optional)
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            className="mt-1.5 h-11 w-full rounded-lg border border-ink-300 px-3.5 text-sm font-normal text-ink-950"
          />
        </label>
        {cancel.error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-brand-700">
            {cancel.error instanceof ApiClientError
              ? cancel.error.message
              : 'The booking could not be cancelled.'}
          </p>
        )}
      </Dialog>
    </div>
  );
}

function Row({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex justify-between gap-4 px-5 py-3 text-sm">
      <dt className="text-ink-500">{term}</dt>
      <dd className="text-right font-medium text-ink-950">{detail}</dd>
    </div>
  );
}
