import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import type { RentalDetail } from '@bmd/shared';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { PaymentsTable } from '@/features/account/components/PaymentsTable';
import { Panel, PanelEmpty } from '@/features/account/components/Panel';
import { formatDate, formatDateTime, shillings } from '@/features/account/format';
import { RENTAL_STATUS } from '@/features/account/labels';
import { cancelRental, fetchRental } from '@/features/rental/api';
import { ApiClientError } from '@/lib/api-client';

export function AccountRentalDetailPage() {
  const { id = '' } = useParams();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['me', 'rentals', 'detail', id],
    queryFn: () => fetchRental(id),
  });

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title="Equipment hire"
        documentTitle={data ? `Hire ${data.reference}` : 'Equipment hire'}
        description="What you have asked for, what it costs, and where it has got to."
      />

      {isPending ? (
        <LoadingState label="Loading your hire…" />
      ) : error ? (
        <ErrorState
          title="This hire could not be loaded"
          message={error instanceof ApiClientError ? error.message : 'The hire is unavailable.'}
          requestId={error instanceof ApiClientError ? error.requestId : undefined}
          onRetry={() => void refetch()}
        />
      ) : (
        <RentalView rental={data} />
      )}
    </div>
  );
}

function RentalView({ rental }: { rental: RentalDetail }) {
  const status = rental.isOverdue
    ? { label: 'Overdue', tone: 'warning' as const }
    : RENTAL_STATUS[rental.status];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        <p className="font-mono text-sm text-ink-500">{rental.reference}</p>
      </div>

      {rental.status === 'PENDING_APPROVAL' && (
        <p className="rounded-card border border-ink-200 bg-ink-50 px-5 py-4 text-sm text-ink-700">
          Studio staff are checking this request. Nothing is charged until it is approved.
        </p>
      )}

      {rental.status === 'REJECTED' && rental.rejectedReason && (
        <p className="rounded-card border border-brand-200 bg-brand-50 px-5 py-4 text-sm text-brand-800">
          The studio could not approve this hire: {rental.rejectedReason}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Equipment" className="lg:col-span-2">
          <ul className="divide-y divide-ink-100">
            {rental.lines.map((line) => (
              <li key={line.key} className="flex justify-between gap-4 px-5 py-3 text-sm">
                <span className="text-ink-700">
                  {line.name} × {line.quantity}
                  <span className="block text-xs text-ink-500">
                    {shillings(line.dailyRateCents)} per day
                  </span>
                </span>
                <span className="font-medium text-ink-950">{shillings(line.totalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="divide-y divide-ink-100 border-t border-ink-200">
            <Row term="Collection" detail={formatDate(rental.startsAt)} />
            <Row term="Return by" detail={formatDate(rental.endsAt)} />
            <Row term="Days" detail={String(rental.days)} />
            {rental.notes && <Row term="Your notes" detail={rental.notes} />}
            {rental.checkedOutAt && (
              <Row term="Collected" detail={formatDateTime(rental.checkedOutAt)} />
            )}
            {rental.returnedAt && (
              <Row term="Returned" detail={formatDateTime(rental.returnedAt)} />
            )}
          </dl>
        </Panel>

        <Panel title="What it costs">
          <dl className="divide-y divide-ink-100">
            <Row term="Hire" detail={shillings(rental.subtotalCents)} />
            <Row term="VAT" detail={shillings(rental.taxCents)} />
            <Row term="Deposit (refundable)" detail={shillings(rental.depositCents)} />
            {rental.lateFeeCents > 0 && (
              <Row term="Late return" detail={shillings(rental.lateFeeCents)} />
            )}
            {rental.damageFeeCents > 0 && (
              <Row term="Damage" detail={shillings(rental.damageFeeCents)} />
            )}
            <Row term="Total" detail={shillings(rental.totalCents)} />
            <Row term="Paid" detail={shillings(rental.paidCents)} />
            <Row
              term={rental.balanceCents > 0 ? 'Still to pay' : 'Balance'}
              detail={rental.balanceCents > 0 ? shillings(rental.balanceCents) : 'Paid in full'}
            />
          </dl>
        </Panel>

        <Panel title="Payments" className="lg:col-span-3">
          {rental.payments.length === 0 ? (
            <PanelEmpty
              icon={CreditCard}
              title="No payments yet"
              description="Payments for this hire will show here, with receipts."
            />
          ) : (
            <PaymentsTable payments={rental.payments} caption="Payments for this hire" />
          )}
        </Panel>
      </div>

      <CancelHire rental={rental} />
    </>
  );
}

function CancelHire({ rental }: { rental: RentalDetail }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const cancel = useMutation({
    mutationFn: () => cancelRental(rental.id, reason.trim() ? { reason: reason.trim() } : {}),
    onSuccess: () => {
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  if (!rental.cancellation.allowed) {
    return rental.cancellation.reason ? (
      <p className="text-sm text-ink-600">
        {rental.cancellation.reason} Contact the studio if you need help.
      </p>
    ) : null;
  }

  return (
    <div>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Cancel this hire
      </Button>

      <Dialog
        open={open}
        title="Cancel this hire?"
        onClose={() => setOpen(false)}
        description={
          rental.cancellation.free ? (
            <>
              This is inside the free cancellation period.
              {rental.cancellation.refundableCents > 0 ? (
                <>
                  {' '}
                  A refund of <strong>{shillings(rental.cancellation.refundableCents)}</strong> will
                  be requested for you.
                </>
              ) : (
                ' Nothing has been paid, so there is nothing to refund.'
              )}
            </>
          ) : (
            <>
              The free cancellation period has passed, so what you have paid is not refunded. The
              equipment will be released for others.
            </>
          )
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep hire
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel hire
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
              : 'The hire could not be cancelled.'}
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
