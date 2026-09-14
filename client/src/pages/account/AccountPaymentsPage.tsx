import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Receipt, Wallet } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { fetchDashboard, fetchPayments } from '@/features/account/api';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { Pagination } from '@/features/account/components/Pagination';
import { PanelEmpty } from '@/features/account/components/Panel';
import { PaymentsTable } from '@/features/account/components/PaymentsTable';
import { StatCard } from '@/features/account/components/StatCard';
import { pageParam, shillings } from '@/features/account/format';
import { ApiClientError } from '@/lib/api-client';

export function AccountPaymentsPage() {
  const [params, setParams] = useSearchParams();
  const page = pageParam(params.get('page'));

  const summary = useQuery({ queryKey: ['me', 'dashboard'], queryFn: fetchDashboard });
  const payments = useQuery({
    queryKey: ['me', 'payments', page],
    queryFn: () => fetchPayments(page),
    placeholderData: keepPreviousData,
  });

  const stats = summary.data?.stats;

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title="Payments"
        description="Every payment on your account, with its receipt number."
      />

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Balance due"
            value={shillings(stats.balanceDueCents)}
            icon={Wallet}
            emphasis={stats.balanceDueCents > 0}
            hint={
              stats.balanceDueCents > 0 ? 'Across your bookings and hires' : 'You’re all paid up'
            }
          />
          <StatCard label="Total paid" value={shillings(stats.totalPaidCents)} icon={Receipt} />
        </div>
      )}

      <div className="rounded-card border border-ink-200 bg-white">
        {payments.isPending ? (
          <LoadingState label="Loading payments…" />
        ) : payments.error ? (
          <div className="p-5">
            <ErrorState
              title="Payments could not be loaded"
              message={
                payments.error instanceof ApiClientError
                  ? payments.error.message
                  : 'Your payments are unavailable.'
              }
              requestId={
                payments.error instanceof ApiClientError ? payments.error.requestId : undefined
              }
              onRetry={() => void payments.refetch()}
            />
          </div>
        ) : payments.data.items.length === 0 ? (
          <PanelEmpty
            icon={CreditCard}
            title="No payments yet"
            description="Payments for your bookings and hires will show here, with receipts."
          />
        ) : (
          <>
            <PaymentsTable payments={payments.data.items} caption="Your payments" />
            <Pagination
              meta={payments.data.meta}
              onPageChange={(next) => setParams({ page: String(next) })}
            />
          </>
        )}
      </div>
    </div>
  );
}
