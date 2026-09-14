import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { isExclusionViolation, isUniqueViolation, prisma } from '../lib/prisma.js';
import { shiftZonedDay, zonedDay, zonedTime } from '../lib/time.js';

export const EXPAND_SHOWS_JOB = 'shows.expand-occurrences';

/** How far ahead airings are materialised on each run. */
export const EXPANSION_HORIZON_DAYS = 28;

export interface ExpansionResult {
  created: number;
  /** Airings already present from an earlier run. */
  existing: number;
  /** Airings refused because another airing already holds the room. */
  conflicts: Array<{ scheduleId: string; startsAt: string }>;
}

interface PlannedAiring {
  scheduleId: string;
  showId: string;
  roomId: string | null;
  startsAt: Date;
  endsAt: Date;
}

const airingKey = (scheduleId: string | null, startsAt: Date): string =>
  `${scheduleId ?? ''}|${startsAt.toISOString()}`;

/**
 * Materialises active show schedules into concrete airings, from today in the
 * studio's timezone through `horizonDays` (R8).
 *
 * The job only ever adds rows. An airing staff have retitled, cancelled or put
 * on air is never rewritten, and narrowing a rule does not delete airings that
 * were already published — those are staff decisions, not the job's. Airings
 * that would already have ended are not backfilled.
 *
 * Idempotent: `(schedule_id, starts_at)` is unique, so a re-run recognises its
 * own earlier rows. When two rules claim the same room at once, the exclusion
 * constraint refuses the later insert and the conflict is reported rather than
 * resolved by guesswork. Rules are processed oldest first, so the established
 * slot keeps the room.
 */
export async function expandShowOccurrences(
  options: { now?: Date; horizonDays?: number } = {},
): Promise<ExpansionResult> {
  const now = options.now ?? new Date();
  const horizonDays = options.horizonDays ?? EXPANSION_HORIZON_DAYS;

  const schedules = await prisma.showSchedule.findMany({
    where: { isActive: true, show: { isActive: true } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      showId: true,
      roomId: true,
      weekdays: true,
      startMinute: true,
      endMinute: true,
      validFrom: true,
      validTo: true,
      room: { select: { studio: { select: { timezone: true } } } },
    },
  });

  const planned = schedules.flatMap((schedule) => {
    if (schedule.endMinute <= schedule.startMinute) {
      logger.warn({ scheduleId: schedule.id }, 'Show schedule ends before it starts; skipped');
      return [];
    }

    // The minutes are wall-clock time where the room is; a show without a
    // room airs on the studio's configured time.
    const timeZone = schedule.room?.studio.timezone ?? env.TIMEZONE;
    const today = zonedDay(now, timeZone);
    const airings: PlannedAiring[] = [];

    for (let offset = 0; offset < horizonDays; offset += 1) {
      const day = shiftZonedDay(today, offset, timeZone);
      if (!schedule.weekdays.includes(day.weekday)) continue;

      const startsAt = zonedTime(day.year, day.month, day.day, schedule.startMinute, timeZone);
      const endsAt = zonedTime(day.year, day.month, day.day, schedule.endMinute, timeZone);

      if (endsAt <= startsAt || endsAt <= now) continue;
      if (startsAt < schedule.validFrom) continue;
      if (schedule.validTo && startsAt >= schedule.validTo) continue;

      airings.push({
        scheduleId: schedule.id,
        showId: schedule.showId,
        roomId: schedule.roomId,
        startsAt,
        endsAt,
      });
    }

    return airings;
  });

  const result: ExpansionResult = { created: 0, existing: 0, conflicts: [] };
  if (planned.length === 0) return result;

  const starts = planned.map((airing) => airing.startsAt.getTime());
  const present = await prisma.showOccurrence.findMany({
    where: {
      scheduleId: { in: [...new Set(planned.map((airing) => airing.scheduleId))] },
      startsAt: { gte: new Date(Math.min(...starts)), lte: new Date(Math.max(...starts)) },
    },
    select: { scheduleId: true, startsAt: true },
  });
  const seen = new Set(present.map((row) => airingKey(row.scheduleId, row.startsAt)));

  for (const airing of planned) {
    if (seen.has(airingKey(airing.scheduleId, airing.startsAt))) {
      result.existing += 1;
      continue;
    }

    try {
      await prisma.showOccurrence.create({ data: airing });
      result.created += 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Another instance inserted it between the read above and this write.
        result.existing += 1;
      } else if (isExclusionViolation(error)) {
        result.conflicts.push({
          scheduleId: airing.scheduleId,
          startsAt: airing.startsAt.toISOString(),
        });
      } else {
        throw error;
      }
    }
  }

  return result;
}
