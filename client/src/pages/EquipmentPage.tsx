import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatKes, type PublicEquipmentItem } from '@bmd/shared';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionNav } from '@/components/ui/SectionNav';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { fetchEquipmentCatalogue } from '@/features/catalogue/api';
import { ApiClientError } from '@/lib/api-client';

const shillings = (cents: number) => formatKes(cents, { withDecimals: false });

export function EquipmentPage() {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['catalogue', 'equipment'],
    queryFn: fetchEquipmentCatalogue,
  });

  return (
    <>
      <PageHeader
        eyebrow="Hire"
        title="Equipment hire"
        description="Microphones, cameras, lighting and audio gear from the studio's own store. Availability shows what is on the shelf right now."
      >
        <Link
          to="/hire"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Request a hire
        </Link>
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {isPending ? (
          <LoadingState label="Loading equipment…" />
        ) : error ? (
          <ErrorState
            title="Equipment could not be loaded"
            message={
              error instanceof ApiClientError
                ? error.message
                : 'The equipment catalogue is unavailable.'
            }
            requestId={error instanceof ApiClientError ? error.requestId : undefined}
            onRetry={() => void refetch()}
          />
        ) : data.length === 0 ? (
          <EmptyState
            title="No equipment is listed for hire"
            description="The studio has not added any hire equipment yet."
          />
        ) : (
          <>
            <SectionNav
              label="Equipment categories"
              items={data.map((category) => ({
                id: `category-${category.slug}`,
                label: category.name,
              }))}
            />

            <div className="mt-10 space-y-14">
              {data.map((category) => (
                <section
                  key={category.slug}
                  id={`category-${category.slug}`}
                  aria-labelledby={`category-${category.slug}-title`}
                  className="scroll-mt-32"
                >
                  <h2
                    id={`category-${category.slug}-title`}
                    className="font-display text-3xl font-bold uppercase text-ink-900"
                  >
                    {category.name}
                  </h2>
                  {category.description && (
                    <p className="mt-1 max-w-2xl text-ink-600">{category.description}</p>
                  )}

                  <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {category.items.map((item) => (
                      <li key={item.key} className="flex">
                        <EquipmentCard item={item} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function EquipmentCard({ item }: { item: PublicEquipmentItem }) {
  const titleId = `equipment-${item.key}-title`;
  const makeAndModel = [item.manufacturer, item.model].filter(Boolean).join(' ');

  return (
    <article
      aria-labelledby={titleId}
      className="flex w-full flex-col rounded-card border border-ink-100 p-5 transition-shadow hover:shadow-sm"
    >
      <h3 id={titleId} className="text-xl font-bold uppercase text-ink-900">
        {item.name}
      </h3>
      {makeAndModel && <p className="text-sm text-ink-500">{makeAndModel}</p>}

      <div className="mt-3">
        {item.availableCount > 0 ? (
          <StatusBadge tone="success">
            {item.availableCount} of {item.unitCount} available
          </StatusBadge>
        ) : (
          <StatusBadge tone="warning">None available</StatusBadge>
        )}
      </div>

      {item.description && <p className="mt-3 text-sm text-ink-600">{item.description}</p>}

      <Link
        to={`/hire?items=${encodeURIComponent(`${item.key}:1`)}`}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-full border border-ink-300 px-4 text-sm font-semibold text-ink-950 transition-colors hover:bg-ink-100"
      >
        Add to a hire
      </Link>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 text-sm">
        <div>
          <dt className="text-ink-500">Per day</dt>
          <dd className="text-lg font-semibold text-ink-900">{shillings(item.dailyRateCents)}</dd>
        </div>
        <div>
          <dt className="text-ink-500">Deposit</dt>
          <dd className="text-lg font-semibold text-ink-900">
            {item.depositCents > 0 ? shillings(item.depositCents) : 'No deposit'}
          </dd>
        </div>
      </dl>
    </article>
  );
}
