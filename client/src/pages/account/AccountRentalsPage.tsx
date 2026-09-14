import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Package } from 'lucide-react';
import type { AccountRentalScope } from '@bmd/shared';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { fetchRentals } from '@/features/account/api';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { Pagination } from '@/features/account/components/Pagination';
import { PanelEmpty } from '@/features/account/components/Panel';
import { RentalListItem } from '@/features/account/components/RentalListItem';
import { ToggleGroup } from '@/features/account/components/ToggleGroup';
import { pageParam } from '@/features/account/format';
import { ApiClientError } from '@/lib/api-client';

export function AccountRentalsPage() {
  const [params, setParams] = useSearchParams();
  const scope: AccountRentalScope = params.get('scope') === 'past' ? 'past' : 'active';
  const page = pageParam(params.get('page'));

  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['me', 'rentals', scope, page],
    queryFn: () => fetchRentals(scope, page),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title="Equipment hire"
        description="Equipment you have on hire, requested or returned."
        actions={
          <ButtonLink to="/equipment" variant="secondary">
            Browse equipment
          </ButtonLink>
        }
      />

      <ToggleGroup
        label="Which hires"
        value={scope}
        options={[
          { value: 'active', label: 'Current' },
          { value: 'past', label: 'Returned & closed' },
        ]}
        onChange={(next) => setParams({ scope: next })}
      />

      <div className="rounded-card border border-ink-200 bg-white">
        {isPending ? (
          <LoadingState label="Loading hires…" />
        ) : error ? (
          <div className="p-5">
            <ErrorState
              title="Equipment hires could not be loaded"
              message={
                error instanceof ApiClientError ? error.message : 'Your hires are unavailable.'
              }
              requestId={error instanceof ApiClientError ? error.requestId : undefined}
              onRetry={() => void refetch()}
            />
          </div>
        ) : data.items.length === 0 ? (
          <PanelEmpty
            icon={Package}
            title={scope === 'active' ? 'No equipment on hire' : 'No past hires'}
            description={
              scope === 'active'
                ? 'Equipment you hire from the studio will show here.'
                : 'Hires you have returned, or that were closed, will show here.'
            }
            action={
              scope === 'active' ? { to: '/equipment', label: 'Browse equipment' } : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-ink-100">
              {data.items.map((rental) => (
                <li key={rental.id}>
                  <RentalListItem rental={rental} />
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
