import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, DoorOpen } from 'lucide-react';
import { PRICING_MODEL_UNIT, formatKes, type PublicService } from '@bmd/shared';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionNav } from '@/components/ui/SectionNav';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { fetchServiceCatalogue } from '@/features/catalogue/api';
import { ApiClientError } from '@/lib/api-client';
import { formatDurationRange } from '@/lib/format';

const shillings = (cents: number) => formatKes(cents, { withDecimals: false });

export function ServicesPage() {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['catalogue', 'services'],
    queryFn: fetchServiceCatalogue,
  });

  return (
    <>
      <PageHeader
        eyebrow="What we produce"
        title="Services & pricing"
        description="Rates are set by studio staff and shown exactly as configured. Your final total is calculated when you book."
      />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {isPending ? (
          <LoadingState label="Loading services…" />
        ) : error ? (
          <ErrorState
            title="Services could not be loaded"
            message={
              error instanceof ApiClientError
                ? error.message
                : 'The service catalogue is unavailable.'
            }
            requestId={error instanceof ApiClientError ? error.requestId : undefined}
            onRetry={() => void refetch()}
          />
        ) : data.length === 0 ? (
          <EmptyState
            title="No services are open for booking"
            description="The studio has not published any bookable services yet."
          />
        ) : (
          <>
            <SectionNav
              label="Service categories"
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

                  <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {category.services.map((service) => (
                      <li key={service.slug} className="flex">
                        <ServiceCard service={service} />
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

function ServiceCard({ service }: { service: PublicService }) {
  const titleId = `service-${service.slug}-title`;
  const roomPricesDiffer = new Set(service.rooms.map((room) => room.priceCents)).size > 1;
  const priceVaries =
    new Set([
      ...service.rooms.map((room) => room.priceCents),
      ...service.packages.map((pkg) => pkg.priceCents),
    ]).size > 1;

  return (
    <article
      aria-labelledby={titleId}
      className="flex w-full flex-col rounded-card border border-ink-100 p-5 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={titleId} className="text-2xl font-bold uppercase text-ink-900">
          {service.name}
        </h3>
        {service.requiresApproval && <StatusBadge tone="info">Approval required</StatusBadge>}
      </div>
      {service.description && <p className="mt-1 text-sm text-ink-600">{service.description}</p>}

      <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
        {priceVaries && <span className="text-sm text-ink-500">From</span>}
        <span className="text-2xl font-semibold text-ink-900">
          {shillings(service.fromPriceCents)}
        </span>
        <span className="text-sm text-ink-500">{PRICING_MODEL_UNIT[service.pricingModel]}</span>
      </p>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex gap-2.5">
          <dt className="pt-0.5 text-ink-400">
            <Clock aria-hidden className="size-4" />
            <span className="sr-only">Session length</span>
          </dt>
          <dd className="text-ink-700">
            {formatDurationRange(service.minDurationMinutes, service.maxDurationMinutes)}
          </dd>
        </div>
        <div className="flex gap-2.5">
          <dt className="pt-0.5 text-ink-400">
            <DoorOpen aria-hidden className="size-4" />
            <span className="sr-only">Rooms</span>
          </dt>
          <dd className="flex-1">
            <ul className="space-y-1">
              {service.rooms.map((room) => (
                <li key={room.slug} className="flex items-baseline justify-between gap-3">
                  <span className="text-ink-700">
                    {room.name}
                    <span className="text-ink-400"> · up to {room.capacity}</span>
                  </span>
                  {roomPricesDiffer && (
                    <span className="whitespace-nowrap font-medium text-ink-900">
                      {shillings(room.priceCents)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>

      {service.packages.length > 0 && (
        <div className="mt-4 border-t border-ink-100 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Packages</h4>
          <ul className="mt-1 divide-y divide-ink-100">
            {service.packages.map((pkg) => (
              <li key={pkg.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-ink-900">{pkg.name}</p>
                  <p className="text-ink-500">
                    {pkg.deliverableCount} edited photos · {pkg.editTurnaroundDays}-day turnaround
                  </p>
                </div>
                <span className="whitespace-nowrap font-semibold text-ink-900">
                  {shillings(pkg.priceCents)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-5">
        <Link
          to="/book"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Book this service
        </Link>
      </div>
    </article>
  );
}
