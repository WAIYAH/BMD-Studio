/**
 * Wall-clock formatting in the studio's timezone. The API sends UTC instants
 * together with the zone they belong to, so a visitor's own device timezone
 * never changes what time a show airs.
 */

const pad = (value: number): string => String(value).padStart(2, '0');

/** `2026-09-14T03:00:00Z` in Africa/Nairobi → `06:00`. */
export function formatClock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** `06:00 – 10:00` */
export function formatClockRange(startIso: string, endIso: string, timeZone: string): string {
  return `${formatClock(startIso, timeZone)} – ${formatClock(endIso, timeZone)}`;
}

/** The calendar date in the zone as `YYYY-MM-DD`; a stable key for grouping by day. */
export function zonedDateKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** `Monday 14 September` */
export function formatDayHeading(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

/** Minutes from midnight → `06:00`; `1440` → `24:00`. */
export function formatMinuteOfDay(minute: number): string {
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdayName = (day: number): string => WEEKDAY_SHORT[day] ?? '';

/** `[1,2,3,4,5]` → `Mon – Fri`; `[1,3,5]` → `Mon, Wed, Fri`; all seven → `Every day`. */
export function formatWeekdays(weekdays: readonly number[]): string {
  const days = [...new Set(weekdays)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);

  if (days.length === 7) return 'Every day';

  const first = days[0];
  const last = days[days.length - 1];
  // Unique and sorted, so the run is unbroken exactly when it spans its length.
  if (
    first !== undefined &&
    last !== undefined &&
    days.length >= 3 &&
    last - first === days.length - 1
  ) {
    return `${weekdayName(first)} – ${weekdayName(last)}`;
  }

  return days.map(weekdayName).join(', ');
}
