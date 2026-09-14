import { useQuery } from '@tanstack/react-query';
import { Clock, ExternalLink, MapPin } from 'lucide-react';
import type { PublicStudio } from '@bmd/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { fetchStudios } from '@/features/studio/api';
import { ApiClientError } from '@/lib/api-client';
import { formatMinuteOfDay } from '@/lib/datetime';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function VisitPage() {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['studios'],
    queryFn: fetchStudios,
  });

  return (
    <>
      <PageHeader
        eyebrow="Visit us"
        title="Visit the studio"
        description="Opening hours, where to find us and the rooms you can book."
      />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {isPending ? (
          <LoadingState label="Loading studio details…" />
        ) : error ? (
          <ErrorState
            title="Studio details could not be loaded"
            message={
              error instanceof ApiClientError ? error.message : 'Studio details are unavailable.'
            }
            requestId={error instanceof ApiClientError ? error.requestId : undefined}
            onRetry={() => void refetch()}
          />
        ) : data.length === 0 ? (
          <EmptyState
            title="No studio details published"
            description="The studio has not published its location and opening hours yet."
          />
        ) : (
          <div className="space-y-16">
            {data.map((studio) => (
              <StudioDetails key={studio.slug} studio={studio} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function StudioDetails({ studio }: { studio: PublicStudio }) {
  const titleId = `studio-${studio.slug}-title`;
  const place = [
    studio.addressLine,
    studio.city,
    studio.county !== studio.city ? studio.county : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(', ');
  const hasContact = Boolean(place || studio.phone || studio.email);

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="font-display text-4xl font-bold uppercase text-ink-950">
        {studio.name}
        {studio.branch && <span className="text-brand-600"> · {studio.branch}</span>}
      </h2>
      {studio.description && <p className="mt-2 max-w-2xl text-ink-600">{studio.description}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby={`${titleId}-hours`}
          className="rounded-card border border-ink-200 p-6"
        >
          <h3
            id={`${titleId}-hours`}
            className="flex items-center gap-2 text-2xl font-bold uppercase text-ink-950"
          >
            <Clock aria-hidden className="size-5 text-brand-600" />
            Opening hours
          </h3>
          {studio.hours.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">Opening hours have not been published yet.</p>
          ) : (
            <dl className="mt-4 divide-y divide-ink-100 text-sm">
              {studio.hours.map((day) => (
                <div key={day.weekday} className="flex justify-between gap-4 py-2.5">
                  <dt className="font-medium text-ink-800">{WEEKDAYS[day.weekday]}</dt>
                  {day.isClosed ? (
                    <dd className="font-semibold uppercase text-brand-700">Closed</dd>
                  ) : (
                    <dd className="font-mono text-ink-950">
                      {`${formatMinuteOfDay(day.openMinute)} – ${formatMinuteOfDay(day.closeMinute)}`}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          )}
        </section>

        <section
          aria-labelledby={`${titleId}-find`}
          className="rounded-card border border-ink-200 p-6"
        >
          <h3
            id={`${titleId}-find`}
            className="flex items-center gap-2 text-2xl font-bold uppercase text-ink-950"
          >
            <MapPin aria-hidden className="size-5 text-brand-600" />
            Find us
          </h3>

          {hasContact ? (
            <dl className="mt-4 space-y-3 text-sm">
              {place && (
                <div>
                  <dt className="text-ink-500">Location</dt>
                  <dd className="font-medium text-ink-950">{place}</dd>
                </div>
              )}
              {studio.phone && (
                <div>
                  <dt className="text-ink-500">Phone</dt>
                  <dd>
                    <a
                      href={`tel:${studio.phone}`}
                      className="font-semibold text-brand-600 hover:text-brand-700"
                    >
                      {studio.phone}
                    </a>
                  </dd>
                </div>
              )}
              {studio.email && (
                <div>
                  <dt className="text-ink-500">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${studio.email}`}
                      className="font-semibold text-brand-600 hover:text-brand-700"
                    >
                      {studio.email}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-ink-500">
              Contact details have not been published yet.
            </p>
          )}

          {studio.location && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${studio.location.latitude},${studio.location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Open in Google Maps
              <ExternalLink aria-hidden className="size-4" />
            </a>
          )}
        </section>
      </div>

      {studio.rooms.length > 0 && (
        <div className="mt-10">
          <h3 className="text-3xl font-bold uppercase text-ink-950">Our rooms</h3>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {studio.rooms.map((room) => (
              <li
                key={room.slug}
                className="rounded-card border-t-4 border-brand-600 bg-ink-50 p-5"
              >
                <p className="font-display text-2xl font-bold uppercase text-ink-950">
                  {room.name}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink-700">
                  Up to {room.capacity} {room.capacity === 1 ? 'person' : 'people'}
                </p>
                {room.description && (
                  <p className="mt-2 text-sm text-ink-600">{room.description}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
