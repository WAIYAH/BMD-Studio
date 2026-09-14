import type { Prisma, StreamPlatformKind } from '@prisma/client';
import {
  SCHEDULE_DEFAULT_DAYS,
  SCHEDULE_MAX_DAYS,
  type PublicAiring,
  type PublicLiveStream,
  type PublicOnAir,
  type PublicSchedule,
  type PublicShow,
  type PublicStreamPlatform,
} from '@bmd/shared';
import { env } from '../config/env.js';
import { ApiError } from '../lib/api-error.js';
import { prisma } from '../lib/prisma.js';
import { shiftZonedDay, zonedDay } from '../lib/time.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const AIRING_SELECT = {
  id: true,
  title: true,
  status: true,
  startsAt: true,
  endsAt: true,
  wentLiveAt: true,
  show: { select: { slug: true, name: true, category: true } },
} satisfies Prisma.ShowOccurrenceSelect;

type AiringRow = Prisma.ShowOccurrenceGetPayload<{ select: typeof AIRING_SELECT }>;

function toAiring(row: AiringRow): PublicAiring {
  return {
    id: row.id,
    showSlug: row.show.slug,
    showName: row.show.name,
    title: row.title,
    category: row.show.category,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
  };
}

/** Active shows and the weekly slots they hold today. */
export async function getShowLineup(now = new Date()): Promise<PublicShow[]> {
  const shows = await prisma.show.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      slug: true,
      name: true,
      description: true,
      category: true,
      schedules: {
        where: {
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
        orderBy: [{ startMinute: 'asc' }, { createdAt: 'asc' }],
        select: { weekdays: true, startMinute: true, endMinute: true },
      },
    },
  });

  return shows.map(({ schedules, ...show }) => ({
    ...show,
    slots: schedules.map((slot) => ({
      weekdays: [...new Set(slot.weekdays)].sort((a, b) => a - b),
      startMinute: slot.startMinute,
      endMinute: slot.endMinute,
    })),
  }));
}

export interface ScheduleWindow {
  from: Date;
  to: Date;
}

/**
 * Resolves the requested schedule window. With no `from`, it opens at the
 * start of today in the studio timezone; with no `to`, it runs for the default
 * span. A window may not be empty, inverted or wider than the maximum.
 */
export function resolveScheduleWindow(
  query: { from?: string; to?: string },
  now = new Date(),
): ScheduleWindow {
  const today = zonedDay(now, env.TIMEZONE);
  const from = query.from ? new Date(query.from) : today.start;

  let to: Date;
  if (query.to) {
    to = new Date(query.to);
  } else if (query.from) {
    to = new Date(from.getTime() + SCHEDULE_DEFAULT_DAYS * DAY_MS);
  } else {
    // Whole local days, so a DST change inside the window cannot clip one.
    to = shiftZonedDay(today, SCHEDULE_DEFAULT_DAYS, env.TIMEZONE).start;
  }

  if (to <= from) {
    throw ApiError.badRequest('The schedule window is invalid.', [
      { path: 'to', message: '`to` must be later than `from`.' },
    ]);
  }
  if (to.getTime() - from.getTime() > SCHEDULE_MAX_DAYS * DAY_MS) {
    throw ApiError.badRequest('The schedule window is too wide.', [
      { path: 'to', message: `A schedule window may span at most ${SCHEDULE_MAX_DAYS} days.` },
    ]);
  }

  return { from, to };
}

/** Airings overlapping the window, in order. Cancelled airings and retired shows are omitted. */
export async function getSchedule(window: ScheduleWindow): Promise<PublicSchedule> {
  const rows = await prisma.showOccurrence.findMany({
    where: {
      status: { not: 'CANCELLED' },
      show: { isActive: true },
      startsAt: { lt: window.to },
      endsAt: { gt: window.from },
    },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    select: AIRING_SELECT,
  });

  return {
    timezone: env.TIMEZONE,
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    airings: rows.map(toAiring),
  };
}

/**
 * What is on air and what airs next. `current` comes only from an airing an
 * operator has put LIVE — a slot covering the present moment is not proof that
 * anything is actually being broadcast.
 */
export async function getOnAir(now = new Date()): Promise<PublicOnAir> {
  const [current, next] = await Promise.all([
    prisma.showOccurrence.findFirst({
      where: { status: 'LIVE' },
      orderBy: [{ wentLiveAt: { sort: 'desc', nulls: 'last' } }, { startsAt: 'desc' }],
      select: AIRING_SELECT,
    }),
    prisma.showOccurrence.findFirst({
      where: { status: 'SCHEDULED', startsAt: { gt: now }, show: { isActive: true } },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      select: AIRING_SELECT,
    }),
  ]);

  return {
    timezone: env.TIMEZONE,
    current: current
      ? { ...toAiring(current), wentLiveAt: current.wentLiveAt?.toISOString() ?? null }
      : null,
    next: next ? toAiring(next) : null,
  };
}

/**
 * Player pages a stream may be framed from, per platform. A stored embed URL
 * on any other host is withheld: framing an arbitrary page on the public site
 * would give whoever set the URL a window onto every visitor.
 */
const EMBED_RULES: Record<StreamPlatformKind, Array<{ host: string; path: RegExp }>> = {
  YOUTUBE: [
    { host: 'www.youtube.com', path: /^\/embed\/[\w-]+$/ },
    { host: 'www.youtube-nocookie.com', path: /^\/embed\/[\w-]+$/ },
  ],
  FACEBOOK: [{ host: 'www.facebook.com', path: /^\/plugins\/video\.php$/ }],
  CUSTOM_RTMP: [],
};

function parseUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Watch links are published only as http(s); `javascript:` and the like are dropped. */
function safeWatchUrl(value: string | null): string | null {
  const url = parseUrl(value);
  return url && (url.protocol === 'https:' || url.protocol === 'http:') ? url.toString() : null;
}

function safeEmbedUrl(platform: StreamPlatformKind, value: string | null): string | null {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:' || url.port !== '') return null;
  const allowed = EMBED_RULES[platform].some(
    (rule) => url.hostname === rule.host && rule.path.test(url.pathname),
  );
  return allowed ? url.toString() : null;
}

/** Streams live right now, with only the platforms a visitor can actually watch. */
export async function getLiveStreams(): Promise<PublicLiveStream[]> {
  const streams = await prisma.stream.findMany({
    where: { status: 'LIVE' },
    orderBy: [{ startedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      description: true,
      startedAt: true,
      occurrence: { select: { show: { select: { name: true } } } },
      platforms: {
        where: { status: 'LIVE' },
        orderBy: { platform: 'asc' },
        select: { platform: true, watchUrl: true, embedUrl: true },
      },
    },
  });

  return streams.flatMap((stream) => {
    const platforms: PublicStreamPlatform[] = stream.platforms
      .map((platform) => ({
        platform: platform.platform,
        watchUrl: safeWatchUrl(platform.watchUrl),
        embedUrl: safeEmbedUrl(platform.platform, platform.embedUrl),
      }))
      .filter((platform) => platform.watchUrl !== null || platform.embedUrl !== null);

    if (platforms.length === 0) return [];

    return [
      {
        id: stream.id,
        title: stream.title,
        description: stream.description,
        showName: stream.occurrence?.show.name ?? null,
        startedAt: stream.startedAt?.toISOString() ?? null,
        platforms,
      },
    ];
  });
}
