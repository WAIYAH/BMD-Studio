import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink, Radio } from 'lucide-react';
import { STREAM_PLATFORM_LABEL, type PublicLiveStream, type PublicOnAir } from '@bmd/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ON_AIR_QUERY_KEY, fetchLiveStreams, fetchOnAir } from '@/features/broadcast/api';
import { ApiClientError } from '@/lib/api-client';
import { formatClock, formatClockRange, formatDayHeading } from '@/lib/datetime';

export function LivePage() {
  const onAir = useQuery({
    queryKey: ON_AIR_QUERY_KEY,
    queryFn: fetchOnAir,
    refetchInterval: 30_000,
  });
  const streams = useQuery({
    queryKey: ['broadcast', 'live-streams'],
    queryFn: fetchLiveStreams,
    refetchInterval: 30_000,
  });

  const error = onAir.error ?? streams.error;

  let content: ReactNode;
  if (error) {
    content = (
      <ErrorState
        title="Live status could not be loaded"
        message={
          error instanceof ApiClientError ? error.message : 'The live service is unavailable.'
        }
        requestId={error instanceof ApiClientError ? error.requestId : undefined}
        onRetry={() => {
          void onAir.refetch();
          void streams.refetch();
        }}
      />
    );
  } else if (!onAir.data || !streams.data) {
    content = <LoadingState label="Checking what is live…" />;
  } else {
    content = <LiveContent onAir={onAir.data} streams={streams.data} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Live"
        title="Watch & listen live"
        description="Streams appear here while the studio is live on a connected platform. When nothing is live, nothing is shown."
      />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">{content}</div>
    </>
  );
}

function LiveContent({ onAir, streams }: { onAir: PublicOnAir; streams: PublicLiveStream[] }) {
  const { current, next, timezone } = onAir;

  return (
    <div className="space-y-10">
      {current && (
        <section
          aria-label="On air now"
          className="flex flex-wrap items-center gap-4 rounded-card border border-onair-200 bg-onair-50 p-5"
        >
          <StatusBadge tone="live" pulse>
            On air
          </StatusBadge>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-navy-900">{current.showName}</p>
            {current.title && <p className="text-sm text-navy-600">{current.title}</p>}
          </div>
          <p className="font-mono text-sm text-navy-600">
            {formatClockRange(current.startsAt, current.endsAt, timezone)}
          </p>
        </section>
      )}

      {streams.length > 0 ? (
        <ul className="space-y-12">
          {streams.map((stream) => (
            <li key={stream.id}>
              <StreamCard stream={stream} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Radio aria-hidden className="size-8" />}
          title={current ? 'No stream is running for this broadcast' : 'Nothing is live right now'}
          description={
            next
              ? `Next on air: ${next.showName}, ${formatDayHeading(next.startsAt, timezone)} at ${formatClock(next.startsAt, timezone)}.`
              : 'Nothing is scheduled to air yet.'
          }
          action={
            <Link
              to="/shows"
              className="text-sm font-semibold text-signal-600 hover:text-signal-700"
            >
              See the full schedule
            </Link>
          }
        />
      )}
    </div>
  );
}

function StreamCard({ stream }: { stream: PublicLiveStream }) {
  const titleId = `stream-${stream.id}-title`;
  const player = stream.platforms.find((platform) => platform.embedUrl);
  const watchLinks = stream.platforms.filter((platform) => platform.watchUrl);

  return (
    <article aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone="live" pulse>
          Live
        </StatusBadge>
        {stream.showName && (
          <span className="text-sm font-medium text-navy-500">{stream.showName}</span>
        )}
      </div>
      <h2 id={titleId} className="mt-2 font-display text-3xl font-bold uppercase text-navy-900">
        {stream.title}
      </h2>
      {stream.description && <p className="mt-1 max-w-2xl text-navy-600">{stream.description}</p>}

      {player?.embedUrl && (
        <div className="mt-5 aspect-video w-full max-w-4xl overflow-hidden rounded-card bg-navy-950">
          <iframe
            src={player.embedUrl}
            title={`${stream.title} on ${STREAM_PLATFORM_LABEL[player.platform]}`}
            className="size-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        </div>
      )}

      {watchLinks.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {watchLinks.map((platform) => (
            <li key={platform.platform}>
              <a
                href={platform.watchUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-3 py-2 text-sm font-semibold text-navy-800 transition-colors hover:bg-navy-50"
              >
                Watch on {STREAM_PLATFORM_LABEL[platform.platform]}
                <ExternalLink aria-hidden className="size-4" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
