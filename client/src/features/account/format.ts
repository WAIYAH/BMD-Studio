import { STUDIO_TIMEZONE, formatKes } from '@bmd/shared';

export const shillings = (cents: number): string => formatKes(cents, { withDecimals: false });

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: STUDIO_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: STUDIO_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const blockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: STUDIO_TIMEZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** A calendar date in studio time, e.g. `14 Sept 2026`. */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** A date and time in studio time, e.g. `14 Sept 2026, 18:00`. */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** The weekday, day and month shown in a booking's date tile. */
export function dateBlock(iso: string): { weekday: string; day: string; month: string } {
  const parts = blockFormat.formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return { weekday: part('weekday'), day: part('day'), month: part('month') };
}

/** `Just now`, `5 min ago`, `3 h ago`, `2 d ago`, then a date. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(iso);
}

/** A 1-based page number from the URL, falling back to the first page. */
export function pageParam(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
