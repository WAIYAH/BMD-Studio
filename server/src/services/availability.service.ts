import type { Prisma, PrismaClient } from '@prisma/client';
import {
  API_ERROR_CODES,
  HOLDING_BOOKING_STATUSES,
  type AvailabilityDay,
  type AvailabilityQuery,
  type AvailabilitySlot,
  type BookingSlotData,
  type DayClosedReason,
  type SlotBlockedReason,
} from '@bmd/shared';
import { ApiError } from '../lib/api-error.js';
import { prisma } from '../lib/prisma.js';
import { shiftZonedDay, zonedDay, zonedTime, type ZonedDay } from '../lib/time.js';
import { getBookingRules, type BookingRules } from './policy.service.js';

/**
 * What can actually be booked, and when.
 *
 * Availability is computed from the studio's opening hours minus everything
 * already holding the room: other bookings and their turnaround, blackout
 * periods, and scheduled or live airings. Nothing here is advisory — the same
 * checks run again inside the booking transaction, and the database's
 * exclusion constraint has the final word.
 */

type DbClient = PrismaClient | Prisma.TransactionClient;

const HOLDING = [...HOLDING_BOOKING_STATUSES];
const MINUTE_MS = 60_000;

const SERVICE_SELECT = {
  id: true,
  slug: true,
  name: true,
  pricingModel: true,
  basePriceCents: true,
  minDurationMin: true,
  maxDurationMin: true,
  slotIntervalMin: true,
  bufferMinutes: true,
  requiresApproval: true,
  isActive: true,
  packages: {
    where: { isActive: true },
    orderBy: { priceCents: 'asc' },
    select: { id: true, name: true, priceCents: true },
  },
} satisfies Prisma.ServiceSelect;

const ROOM_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  bufferMinutes: true,
  studio: { select: { id: true, name: true, timezone: true, isActive: true } },
} satisfies Prisma.StudioRoomSelect;

export interface BookingTarget {
  service: Prisma.ServiceGetPayload<{ select: typeof SERVICE_SELECT }>;
  room: Prisma.StudioRoomGetPayload<{ select: typeof ROOM_SELECT }>;
  /** The room's price override where one is set, otherwise the service's base price. */
  rateCents: number;
  timezone: string;
  /** The turnaround this room needs after a session of this service. */
  bufferMinutes: number;
}

/**
 * Resolves a service and room pair, refusing anything a customer could not
 * book. Room slugs are unique per studio, so the pairing is matched through
 * the `room_services` link rather than by slug alone.
 */
export async function loadBookingTarget(
  client: DbClient,
  serviceSlug: string,
  roomSlug: string,
): Promise<BookingTarget> {
  const link = await client.roomService.findFirst({
    where: { service: { slug: serviceSlug }, room: { slug: roomSlug } },
    orderBy: { roomId: 'asc' },
    select: {
      priceCentsOverride: true,
      service: { select: SERVICE_SELECT },
      room: { select: ROOM_SELECT },
    },
  });

  if (!link || !link.service.isActive || !link.room.studio.isActive) {
    throw ApiError.notFound('That service and room');
  }

  return {
    service: link.service,
    room: link.room,
    rateCents: link.priceCentsOverride ?? link.service.basePriceCents,
    timezone: link.room.studio.timezone,
    bufferMinutes: Math.max(link.room.bufferMinutes, link.service.bufferMinutes),
  };
}

interface BusyRange {
  start: Date;
  end: Date;
  reason: SlotBlockedReason;
}

interface SlotPlan {
  day: ZonedDay;
  timezone: string;
  openMinute: number;
  closeMinute: number;
  durationMinutes: number;
  slotIntervalMinutes: number;
  bufferMinutes: number;
  busy: BusyRange[];
  now: Date;
}

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean =>
  aStart < bEnd && bStart < aEnd;

/**
 * The slot grid for one day. Pure: everything it needs has already been read,
 * which is what makes the day-boundary and buffer behaviour testable.
 *
 * A candidate is compared against other bookings including its own turnaround,
 * because the room must be free to be cleared afterwards; blackouts and
 * airings are compared against the session itself.
 */
function buildSlots(plan: SlotPlan): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const { day, timezone, durationMinutes, bufferMinutes } = plan;

  for (
    let minute = plan.openMinute;
    minute + durationMinutes <= plan.closeMinute;
    minute += plan.slotIntervalMinutes
  ) {
    const startsAt = zonedTime(day.year, day.month, day.day, minute, timezone);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * MINUTE_MS);
    const blockedUntil = new Date(endsAt.getTime() + bufferMinutes * MINUTE_MS);

    let blockedBy: SlotBlockedReason | null = startsAt <= plan.now ? 'IN_THE_PAST' : null;

    if (!blockedBy) {
      for (const busy of plan.busy) {
        const candidateEnd = busy.reason === 'BOOKED' ? blockedUntil : endsAt;
        if (overlaps(startsAt, candidateEnd, busy.start, busy.end)) {
          blockedBy = busy.reason;
          break;
        }
      }
    }

    slots.push({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      available: blockedBy === null,
      blockedBy,
    });
  }

  return slots;
}

/** Everything holding the room over a window, already buffered where it applies. */
async function loadBusy(
  client: DbClient,
  roomId: string,
  studioId: string,
  from: Date,
  to: Date,
  options: { ignoreBookingId?: string } = {},
): Promise<BusyRange[]> {
  const [bookings, blackouts, airings] = await Promise.all([
    client.booking.findMany({
      where: {
        roomId,
        status: { in: HOLDING },
        startsAt: { lt: to },
        // A booking's turnaround can reach into this window even when the
        // session itself ended before it.
        OR: [{ endsAt: { gt: from } }, { blockedUntil: { gt: from } }],
        ...(options.ignoreBookingId ? { id: { not: options.ignoreBookingId } } : {}),
      },
      select: { startsAt: true, endsAt: true, blockedUntil: true },
    }),
    client.blackoutPeriod.findMany({
      where: {
        studioId,
        OR: [{ roomId: null }, { roomId }],
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: { startsAt: true, endsAt: true },
    }),
    client.showOccurrence.findMany({
      where: {
        roomId,
        status: { in: ['SCHEDULED', 'LIVE'] },
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  return [
    ...bookings.map((row) => ({
      start: row.startsAt,
      end: row.blockedUntil ?? row.endsAt,
      reason: 'BOOKED' as const,
    })),
    ...blackouts.map((row) => ({
      start: row.startsAt,
      end: row.endsAt,
      reason: 'BLACKOUT' as const,
    })),
    ...airings.map((row) => ({
      start: row.startsAt,
      end: row.endsAt,
      reason: 'ON_AIR' as const,
    })),
  ];
}

function assertDuration(target: BookingTarget, durationMinutes: number): void {
  const { minDurationMin, maxDurationMin, slotIntervalMin } = target.service;

  if (durationMinutes < minDurationMin || durationMinutes > maxDurationMin) {
    throw ApiError.badRequest('That session length is not offered for this service.', [
      {
        path: 'durationMinutes',
        message: `Choose between ${minDurationMin} and ${maxDurationMin} minutes.`,
      },
    ]);
  }

  if (durationMinutes % slotIntervalMin !== 0) {
    throw ApiError.badRequest('That session length is not offered for this service.', [
      {
        path: 'durationMinutes',
        message: `Session lengths go up in steps of ${slotIntervalMin} minutes.`,
      },
    ]);
  }
}

interface DayHours {
  openMinute: number;
  closeMinute: number;
}

async function openingHours(
  client: DbClient,
  studioId: string,
  weekday: number,
): Promise<DayHours | null> {
  const row = await client.operatingHour.findUnique({
    where: { studioId_weekday: { studioId, weekday } },
    select: { openMinute: true, closeMinute: true, isClosed: true },
  });

  if (!row || row.isClosed || row.closeMinute <= row.openMinute) return null;
  return { openMinute: row.openMinute, closeMinute: row.closeMinute };
}

/** The studio day a `YYYY-MM-DD` string names. Noon avoids every edge case. */
function dayFromDate(date: string, timezone: string): ZonedDay {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    throw ApiError.badRequest('That is not a valid date.', [
      { path: 'date', message: 'Use the format YYYY-MM-DD.' },
    ]);
  }
  return zonedDay(zonedTime(year, month, day, 12 * 60, timezone), timezone);
}

/** Why the whole day is unbookable, or null when it can be offered. */
function dayClosedReason(
  target: BookingTarget,
  day: ZonedDay,
  hours: DayHours | null,
  durationMinutes: number,
  rules: BookingRules,
  now: Date,
): DayClosedReason | null {
  if (target.room.status !== 'ACTIVE') return 'ROOM_UNAVAILABLE';

  const today = zonedDay(now, target.timezone);
  if (day.date < today.date) return 'IN_THE_PAST';

  if (rules.maxAdvanceDays !== null) {
    const last = shiftZonedDay(today, rules.maxAdvanceDays, target.timezone);
    if (day.date > last.date) return 'BEYOND_BOOKING_WINDOW';
  }

  if (!hours) return 'CLOSED';
  if (hours.closeMinute - hours.openMinute < durationMinutes) return 'TOO_SHORT_A_DAY';
  return null;
}

export async function getAvailability(
  query: AvailabilityQuery,
  now = new Date(),
): Promise<AvailabilityDay> {
  const target = await loadBookingTarget(prisma, query.service, query.room);
  assertDuration(target, query.duration);

  const rules = await getBookingRules();
  const day = dayFromDate(query.date, target.timezone);
  const hours = await openingHours(prisma, target.room.studio.id, day.weekday);
  const closedReason = dayClosedReason(target, day, hours, query.duration, rules, now);

  const base = {
    date: day.date,
    timezone: target.timezone,
    serviceSlug: target.service.slug,
    roomSlug: target.room.slug,
    durationMinutes: query.duration,
  };

  if (closedReason || !hours) {
    return {
      ...base,
      isOpen: false,
      closedReason: closedReason ?? 'CLOSED',
      opensAt: null,
      closesAt: null,
      slots: [],
    };
  }

  const opensAt = zonedTime(day.year, day.month, day.day, hours.openMinute, target.timezone);
  const closesAt = zonedTime(day.year, day.month, day.day, hours.closeMinute, target.timezone);

  // Reach past closing time so a late booking's turnaround is still seen.
  const busy = await loadBusy(
    prisma,
    target.room.id,
    target.room.studio.id,
    day.start,
    new Date(day.end.getTime() + 12 * 60 * MINUTE_MS),
  );

  return {
    ...base,
    isOpen: true,
    closedReason: null,
    opensAt: opensAt.toISOString(),
    closesAt: closesAt.toISOString(),
    slots: buildSlots({
      day,
      timezone: target.timezone,
      openMinute: hours.openMinute,
      closeMinute: hours.closeMinute,
      durationMinutes: query.duration,
      slotIntervalMinutes: target.service.slotIntervalMin,
      bufferMinutes: target.bufferMinutes,
      busy,
      now,
    }),
  };
}

export interface CheckedSlot {
  startsAt: Date;
  endsAt: Date;
  /** End of the room's turnaround; what the overlap constraint actually covers. */
  blockedUntil: Date;
  /** Null when the slot can be taken right now. */
  blockedBy: SlotBlockedReason | null;
  package: { id: string; name: string; priceCents: number } | null;
}

/**
 * Re-checks one specific slot, the way `getAvailability` checks a whole day.
 *
 * Structural problems — a session outside opening hours, a length the service
 * does not offer, a start that is not on the slot grid — throw, because they
 * mean the request was built wrongly. A slot that is merely taken comes back
 * as `blockedBy`, so a quote can say so without failing.
 */
export async function checkSlot(
  client: DbClient,
  target: BookingTarget,
  request: BookingSlotData,
  rules: BookingRules,
  now: Date,
  options: { ignoreBookingId?: string } = {},
): Promise<CheckedSlot> {
  assertDuration(target, request.durationMinutes);

  const startsAt = new Date(request.startsAt);
  const endsAt = new Date(startsAt.getTime() + request.durationMinutes * MINUTE_MS);
  const blockedUntil = new Date(endsAt.getTime() + target.bufferMinutes * MINUTE_MS);

  const day = zonedDay(startsAt, target.timezone);
  const hours = await openingHours(client, target.room.studio.id, day.weekday);
  const closed = dayClosedReason(target, day, hours, request.durationMinutes, rules, now);

  if (closed === 'IN_THE_PAST') {
    throw ApiError.badRequest('That time has already passed.', [
      { path: 'startsAt', message: 'Choose a time in the future.' },
    ]);
  }
  if (closed === 'ROOM_UNAVAILABLE') {
    throw ApiError.conflict(
      API_ERROR_CODES.SLOT_UNAVAILABLE,
      'That room is not available for booking at the moment.',
    );
  }
  if (closed === 'BEYOND_BOOKING_WINDOW') {
    throw ApiError.badRequest(
      rules.maxAdvanceDays === null
        ? 'That date is too far ahead.'
        : `Sessions can be booked up to ${rules.maxAdvanceDays} days ahead.`,
      [{ path: 'startsAt', message: 'Choose an earlier date.' }],
    );
  }
  if (closed || !hours) {
    throw new ApiError(
      400,
      API_ERROR_CODES.OUTSIDE_OPERATING_HOURS,
      'The studio is not open then.',
      { details: [{ path: 'startsAt', message: 'Choose a time within opening hours.' }] },
    );
  }

  const minuteOfDay = Math.round((startsAt.getTime() - day.start.getTime()) / MINUTE_MS);
  const onTheGrid =
    Number.isInteger(minuteOfDay) &&
    minuteOfDay >= hours.openMinute &&
    (minuteOfDay - hours.openMinute) % target.service.slotIntervalMin === 0;

  if (!onTheGrid || minuteOfDay + request.durationMinutes > hours.closeMinute) {
    throw new ApiError(
      400,
      API_ERROR_CODES.OUTSIDE_OPERATING_HOURS,
      'That session does not fit the studio’s opening hours.',
      {
        details: [
          {
            path: 'startsAt',
            message: `Sessions start every ${target.service.slotIntervalMin} minutes, and must end by closing time.`,
          },
        ],
      },
    );
  }

  const chosenPackage = resolvePackage(target, request.packageId);

  const busy = await loadBusy(
    client,
    target.room.id,
    target.room.studio.id,
    startsAt,
    blockedUntil,
    options,
  );

  let blockedBy: SlotBlockedReason | null = startsAt <= now ? 'IN_THE_PAST' : null;
  if (!blockedBy) {
    for (const entry of busy) {
      const candidateEnd = entry.reason === 'BOOKED' ? blockedUntil : endsAt;
      if (overlaps(startsAt, candidateEnd, entry.start, entry.end)) {
        blockedBy = entry.reason;
        break;
      }
    }
  }

  return { startsAt, endsAt, blockedUntil, blockedBy, package: chosenPackage };
}

/** The chosen package, insisting on one when the service is priced per package. */
function resolvePackage(
  target: BookingTarget,
  packageId: string | undefined,
): { id: string; name: string; priceCents: number } | null {
  const packages = target.service.packages;

  if (packageId) {
    const chosen = packages.find((entry) => entry.id === packageId);
    if (!chosen) {
      throw ApiError.badRequest('That package is not offered for this service.', [
        { path: 'packageId', message: 'Choose one of the packages listed.' },
      ]);
    }
    return chosen;
  }

  if (target.service.pricingModel === 'PACKAGE' && packages.length > 0) {
    throw ApiError.badRequest('Choose a package for this service.', [
      { path: 'packageId', message: 'A package is required.' },
    ]);
  }

  return null;
}
