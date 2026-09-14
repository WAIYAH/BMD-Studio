import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Images } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { fetchDeliverables } from '@/features/account/api';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { DeliverableListItem } from '@/features/account/components/DeliverableListItem';
import { Pagination } from '@/features/account/components/Pagination';
import { PanelEmpty } from '@/features/account/components/Panel';
import { pageParam } from '@/features/account/format';
import { ApiClientError } from '@/lib/api-client';

export function AccountDeliverablesPage() {
  const [params, setParams] = useSearchParams();
  const page = pageParam(params.get('page'));

  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['me', 'deliverables', page],
    queryFn: () => fetchDeliverables(page),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title="Deliverables"
        description="Photos, recordings and edits from your sessions, and when to expect them."
      />

      <div className="rounded-card border border-ink-200 bg-white">
        {isPending ? (
          <LoadingState label="Loading deliverables…" />
        ) : error ? (
          <div className="p-5">
            <ErrorState
              title="Deliverables could not be loaded"
              message={
                error instanceof ApiClientError
                  ? error.message
                  : 'Your deliverables are unavailable.'
              }
              requestId={error instanceof ApiClientError ? error.requestId : undefined}
              onRetry={() => void refetch()}
            />
          </div>
        ) : data.items.length === 0 ? (
          <PanelEmpty
            icon={Images}
            title="Nothing to collect yet"
            description="Photos, recordings and edits from your sessions will show here."
          />
        ) : (
          <>
            <ul className="divide-y divide-ink-100">
              {data.items.map((deliverable) => (
                <li key={deliverable.id}>
                  <DeliverableListItem deliverable={deliverable} />
                </li>
              ))}
            </ul>
            <Pagination
              meta={data.meta}
              onPageChange={(next) => setParams({ page: String(next) })}
            />
          </>
        )}
      </div>
    </div>
  );
}
