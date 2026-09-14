import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import type { PublicAiring, PublicSchedule, PublicShow } from '@bmd/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { fetchSchedule, fetchShowLineup } from '@/features/broadcast/api';
import { ApiClientError } from '@/lib/api-client';
import {
  formatClockRange,
  formatDayHeading,
  formatMinuteOfDay,
  formatWeekdays,
  zonedDateKey,
} from '@/lib/datetime';

export function ShowsPage() {
  const schedule = useQuery({ queryKey: ['broadcast', 'schedule'], queryFn: fetchSchedule });
  const lineup = useQuery({ queryKey: ['broadcast', 'lineup'], queryFn: fetchShowLineup });

  return (
    <>
      <PageHeader
        eyebrow="On the air"
        title="Shows & schedule"
        description="The week ahead, straight from the studio's broadcast schedule. All times are studio time."
      />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <section aria-labelledby="schedule-title">
          <h2
            id="schedule-title"
            className="font-display text-3xl font-bold uppercase text-navy-900"
          >
            This week
          </h2>

          <div className="mt-6">
            {schedule.isPending ? (
              <LoadingState label="Loading the schedule…" />
            ) : schedule.error ? (
              <ErrorState
                title="The schedule could not be loaded"
                message={
                  schedule.error instanceof ApiClientError
                    ? schedule.error.message
                    : 'The broadcast schedule is unavailable.'
                }
                requestId={
                  schedule.error instanceof ApiClientError ? schedule.error.requestId : undefined
                }
                onRetry={() => void schedule.refetch()}
              />
            ) : schedule.data.airings.length === 0 ? (
              <EmptyState
                title="Nothing is scheduled this week"
                description="No airings have been scheduled for the next seven days."
              />
            ) : (
              <ScheduleDays schedule={schedule.data} />
            )}
          </div>
        </section>

        <section aria-labelledby="lineup-title" className="mt-16">
          <h2 id="lineup-title" className="font-display text-3xl font-bold uppercase text-navy-900">
            The line-up
          </h2>

          <div className="mt-6">
            {lineup.isPending ? (
              <LoadingState label="Loading shows…" />
            ) : lineup.error ? (
              <ErrorState
                title="Shows could not be loaded"
                message={
                  lineup.error instanceof ApiClientError
                    ? lineup.error.message
                    : 'The show line-up is unavailable.'
                }
                requestId={
                  lineup.error instanceof ApiClientError ? lineup.error.requestId : undefined
                }
                onRetry={() => void lineup.refetch()}
              />
            ) : lineup.data.length === 0 ? (
              <EmptyState
                title="No shows on the line-up"
                description="The studio has not published any shows yet."
              />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {lineup.data.map((show) => (
                  <li key={show.slug} className="flex">
                    <ShowCard show={show} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

interface ScheduleDay {
  key: string;
  label: string;
  airings: PublicAiring[];
}

/** Airings arrive in start order, so each studio day is one consecutive run. */
function groupByDay(airings: PublicAiring[], timeZone: string): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  for (const airing of airings) {
    const key = zonedDateKey(airing.startsAt, timeZone);
    const last = days.at(-1);
    if (last?.key === key) {
      last.airings.push(airing);
    } else {
      days.push({ key, label: formatDayHeading(airing.startsAt, timeZone), airings: [airing] });
    }
  }
  return days;
}

function ScheduleDays({ schedule }: { schedule: PublicSchedule }) {
  return (
    <ol className="space-y-8">
      {groupByDay(schedule.airings, schedule.timezone).map((day) => (
        <li key={day.key}>
          <section aria-labelledby={`day-${day.key}`}>
            <h3
              id={`day-${day.key}`}
              className="text-sm font-semibold uppercase tracking-wide text-navy-500"
            >
              {day.label}
            </h3>
            <ul className="mt-3 divide-y divide-navy-100 rounded-card border border-navy-100">
              {day.airings.map((airing) => (
                <li key={airing.id}>
                  <AiringRow airing={airing} timeZone={schedule.timezone} />
                </li>
              ))}
            </ul>
          </section>
        </li>
      ))}
    </ol>
  );
}

function AiringRow({ airing, timeZone }: { airing: PublicAiring; timeZone: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
      <time dateTime={airing.startsAt} className="w-32 shrink-0 font-mono text-sm text-navy-600">
        {formatClockRange(airing.startsAt, airing.endsAt, timeZone)}
      </time>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-navy-900">{airing.showName}</p>
        {airing.title && <p className="text-sm text-navy-600">{airing.title}</p>}
      </div>
      {airing.category && <span className="text-sm text-navy-500">{airing.category}</span>}
      {airing.status === 'LIVE' && (
        <StatusBadge tone="live" pulse>
          On air
        </StatusBadge>
      )}
      {airing.status === 'ENDED' && <StatusBadge>Ended</StatusBadge>}
    </div>
  );
}

function ShowCard({ show }: { show: PublicShow }) {
  const titleId = `show-${show.slug}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className="flex w-full flex-col rounded-card border border-navy-100 p-5"
    >
      {show.category && (
        <p className="text-xs font-semibold uppercase tracking-wide text-signal-600">
          {show.category}
        </p>
      )}
      <h3 id={titleId} className="mt-1 text-2xl font-bold uppercase text-navy-900">
        {show.name}
      </h3>
      {show.description && <p className="mt-1 text-sm text-navy-600">{show.description}</p>}

      <div className="mt-4 flex gap-2.5 text-sm">
        <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-navy-400" />
        {show.slots.length === 0 ? (
          <p className="text-navy-500">No regular slot at the moment</p>
        ) : (
          <ul className="space-y-1 text-navy-700">
            {show.slots.map((slot) => (
              <li key={`${slot.weekdays.join('-')}@${slot.startMinute}`}>
                {`${formatWeekdays(slot.weekdays)} · ${formatMinuteOfDay(slot.startMinute)} – ${formatMinuteOfDay(slot.endMinute)}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
