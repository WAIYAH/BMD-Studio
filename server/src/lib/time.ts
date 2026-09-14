/**
 * Calendar arithmetic in a named timezone.
 *
 * Storage is UTC; "today", "this month" and opening hours are wall-clock ideas
 * that belong to the studio's timezone. These helpers convert between the two
 * using Intl only, so no host locale or TZ setting can change the answer.
 */

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function partsInZone(instant: Date, timeZone: string): ZonedParts {
  const values: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year ?? 0,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

/** Milliseconds the zone is ahead of UTC at `instant`. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = partsInZone(instant, timeZone);
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant at which the wall clock in `timeZone` reads the given date and
 * minute of day. Two passes settle the offset across a DST transition.
 */
export function zonedTime(
  year: number,
  month: number,
  day: number,
  minuteOfDay: number,
  timeZone: string,
): Date {
  const wallClock = Date.UTC(year, month - 1, day) + minuteOfDay * 60_000;
  const firstOffset = zoneOffsetMs(new Date(wallClock), timeZone);
  let result = wallClock - firstOffset;
  const secondOffset = zoneOffsetMs(new Date(result), timeZone);
  if (secondOffset !== firstOffset) result = wallClock - secondOffset;
  return new Date(result);
}

export interface ZonedDay {
  /** Local midnight, as a UTC instant. */
  start: Date;
  /** The following local midnight (exclusive). */
  end: Date;
  /** `YYYY-MM-DD` in the zone. */
  date: string;
  /** 0 = Sunday … 6 = Saturday, matching `operating_hours.weekday`. */
  weekday: number;
  year: number;
  month: number;
  day: number;
}

const pad = (value: number): string => String(value).padStart(2, '0');

export function zonedDay(instant: Date, timeZone: string): ZonedDay {
  const { year, month, day } = partsInZone(instant, timeZone);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: zonedTime(year, month, day, 0, timeZone),
    end: zonedTime(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, timeZone),
    date: `${year}-${pad(month)}-${pad(day)}`,
    weekday: calendar.getUTCDay(),
    year,
    month,
    day,
  };
}

/** The local day `offsetDays` away from `day` (negative for the past). */
export function shiftZonedDay(day: ZonedDay, offsetDays: number, timeZone: string): ZonedDay {
  const calendar = new Date(Date.UTC(day.year, day.month - 1, day.day + offsetDays, 12));
  // Noon in UTC lands on the same calendar date in every zone within ±12h.
  const {
    year,
    month,
    day: d,
  } = {
    year: calendar.getUTCFullYear(),
    month: calendar.getUTCMonth() + 1,
    day: calendar.getUTCDate(),
  };
  return zonedDay(zonedTime(year, month, d, 12 * 60, timeZone), timeZone);
}

export function startOfZonedMonth(instant: Date, timeZone: string): Date {
  const { year, month } = partsInZone(instant, timeZone);
  return zonedTime(year, month, 1, 0, timeZone);
}
