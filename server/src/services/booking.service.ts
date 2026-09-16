import type { BookingStatus, Prisma } from '@prisma/client';
import {
  API_ERROR_CODES,
  type BookingCancellation,
  type BookingDetail,
  type BookingItemLine,
  type BookingQuote,
  type BookingSlotData,
  type BookingStatusEvent,
  type CancelBookingData,
  type CreateBookingData,
  type RescheduleBookingData,
  type SlotBlockedReason,
} from '@bmd/shared';
import { ApiError } from '../lib/api-error.js';
import { auditRow, type RequestContext } from '../lib/audit.js';
import { priceBooking, type PriceBookingInput } from '../lib/pricing.js';
import { isExclusionViolation, prisma } from '../lib/prisma.js';
import { withReference } from '../lib/references.js';
import {
  checkSlot,
  loadBookingTarget,
  type BookingTarget,
  type CheckedSlot,
} from './availability.service.js';
import { DELIVERABLE_SELECT, PAYMENT_SELECT, toDeliverable, toPayment } from './account.service.js';
import { getBookingRules, type BookingRules } from './policy.service.js';

/**
 * Making, reading, cancelling and moving a customer's own bookings.
 *
 * Two rules run through all of it. The price is always recomputed here, never
 * read from the request. And the room is only ever claimed inside a
 * transaction that holds an advisory lock on it, with PostgreSQL's exclusion
 * constraint as the backstop if anything slips past.
 */

export const EXPIRE_HOLDS_JOB = 'bookings.expire-holds';

const HOUR_MS = 3_600_000;

/** Statuses a customer can still act on. */
const LIVE_STATUSES: BookingStatus[] = ['PENDING_PAYMENT', 'PENDING_APPROVAL', 'CONFIRMED'];

const REFUND_HELD_STATUSES = ['PENDING', 'PROCESSING', 'SUCCESSFUL'] as const;

const DETAIL_SELECT = {
  id: true,
  reference: true,
  status: true,
  startsAt: true,
  endsAt: true,
  blockedUntil: true,
  notes: true,
  subtotalCents: true,
  taxCents: true,
  totalCents: true,
  depositCents: true,
  holdExpiresAt: true,
  createdAt: true,
  customerId: true,
  studio: { select: { name: true, timezone: true } },
  room: { select: { slug: true, name: true } },
  service: { select: { slug: true, name: true, requiresApproval: true } },
  package: { select: { name: true } },
  rescheduledTo: { select: { reference: true } },
  rescheduledFrom: { select: { reference: true } },
  items: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      kind: true,
      label: true,
      quantity: true,
      unitPriceCents: true,
      totalCents: true,
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' },
    select: {
      fromStatus: true,
      toStatus: true,
      reason: true,
      actorId: true,
      createdAt: true,
    },
  },
  payments: {
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: PAYMENT_SELECT,
  },
  deliverables: {
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: DELIVERABLE_SELECT,
  },
} satisfies Prisma.BookingSelect;

type DetailRow = Prisma.BookingGetPayload<{ select: typeof DETAIL_SELECT }>;

const minutesBetween = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / 60_000);

/** What a blocked slot means to whoever asked for it. */
function slotError(blockedBy: SlotBlockedReason): ApiError {
  switch (blockedBy) {
    case 'BLACKOUT':
      return ApiError.conflict(
        API_ERROR_CODES.BLACKOUT_PERIOD,
        'The studio is closed at that time.',
      );
    case 'ON_AIR':
      return ApiError.conflict(
        API_ERROR_CODES.SLOT_UNAVAILABLE,
        'A show is scheduled in that room at that time.',
      );
    case 'IN_THE_PAST':
      return ApiError.badRequest('That time has already passed.', [
        { path: 'startsAt', message: 'Choose a time in the future.' },
      ]);
    default:
      return ApiError.conflict(
        API_ERROR_CODES.SLOT_UNAVAILABLE,
        'That slot has just been taken. Choose another time.',
      );
  }
}

function pricingInput(target: BookingTarget, slot: CheckedSlot, rules: BookingRules) {
  return {
    pricingModel: target.service.pricingModel,
    serviceName: target.service.name,
    roomName: target.room.name,
    rateCents: target.rateCents,
    durationMinutes: minutesBetween(slot.startsAt, slot.endsAt),
    packageName: slot.package?.name ?? null,
    packagePriceCents: slot.package?.priceCents ?? null,
    vatPercent: rules.vatPercent,
    depositPercent: rules.depositPercent,
  } satisfies PriceBookingInput;
}

/**
 * Locks the room for the rest of the transaction, so two requests for the same
 * room queue rather than race. The exclusion constraint would catch a genuine
 * overlap anyway; the lock is what lets the second request answer with a clear
 * "that slot has just been taken" instead of a constraint violation.
 */
async function lockRoom(tx: Prisma.TransactionClient, roomId: string): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${roomId}, 0))::text`;
}

export async function quoteBooking(
  request: BookingSlotData,
  now = new Date(),
): Promise<BookingQuote> {
  const [target, rules] = await Promise.all([
    loadBookingTarget(prisma, request.service, request.room),
    getBookingRules(),
  ]);

  const slot = await checkSlot(prisma, target, request, rules, now);
  const priced = priceBooking(pricingInput(target, slot, rules));

  return {
    serviceSlug: target.service.slug,
    serviceName: target.service.name,
    roomSlug: target.room.slug,
    roomName: target.room.name,
    studioName: target.room.studio.name,
    pricingModel: target.service.pricingModel,
    packageName: slot.package?.name ?? null,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    durationMinutes: request.durationMinutes,
    timezone: target.timezone,
    lines: priced.lines,
    subtotalCents: priced.subtotalCents,
    taxCents: priced.taxCents,
    totalCents: priced.totalCents,
    depositCents: priced.depositCents,
    vatPercent: rules.vatPercent,
    depositPercent: rules.depositPercent,
    requiresApproval: target.service.requiresApproval,
    cancellationWindowHours: rules.cancellationWindowHours,
    paymentHoldMinutes: rules.paymentHoldMinutes,
    available: slot.blockedBy === null,
    blockedBy: slot.blockedBy,
  };
}

/**
 * The status a new booking starts in. A service needing approval waits for
 * staff; otherwise the room is held until the deposit arrives, unless nothing
 * is due up front, in which case it is confirmed at once.
 */
function openingStatus(requiresApproval: boolean, depositCents: number): BookingStatus {
  if (requiresApproval) return 'PENDING_APPROVAL';
  return depositCents > 0 ? 'PENDING_PAYMENT' : 'CONFIRMED';
}

export async function createBooking(
  userId: string,
  input: CreateBookingData,
  ctx: RequestContext,
  now = new Date(),
): Promise<BookingDetail> {
  const rules = await getBookingRules();

  const bookingId = await withReference('BMD', (reference) =>
    prisma
      .$transaction(
        async (tx) => {
          const target = await loadBookingTarget(tx, input.service, input.room);
          await lockRoom(tx, target.room.id);

          const slot = await checkSlot(tx, target, input, rules, now);
          if (slot.blockedBy) throw slotError(slot.blockedBy);

          const priced = priceBooking(pricingInput(target, slot, rules));
          const status = openingStatus(target.service.requiresApproval, priced.depositCents);

          const booking = await tx.booking.create({
            data: {
              reference,
              customerId: userId,
              studioId: target.room.studio.id,
              roomId: target.room.id,
              serviceId: target.service.id,
              packageId: slot.package?.id ?? null,
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              blockedUntil: slot.blockedUntil,
              status,
              subtotalCents: priced.subtotalCents,
              taxCents: priced.taxCents,
              totalCents: priced.totalCents,
              depositCents: priced.depositCents,
              notes: input.notes ?? null,
              holdExpiresAt:
                status === 'PENDING_PAYMENT'
                  ? new Date(now.getTime() + rules.paymentHoldMinutes * 60_000)
                  : null,
              items: {
                create: priced.lines.map((line) => ({
                  kind: line.kind,
                  label: line.label,
                  serviceId: target.service.id,
                  quantity: line.quantity,
                  unitPriceCents: line.unitPriceCents,
                  totalCents: line.totalCents,
                })),
              },
              statusHistory: {
                create: { toStatus: status, actorId: userId, reason: 'Booked online' },
              },
            },
            select: { id: true },
          });

          await tx.auditLog.create({
            data: auditRow(
              {
                action: 'booking.created',
                entityType: 'booking',
                entityId: booking.id,
                actorId: userId,
                after: {
                  reference,
                  status,
                  startsAt: slot.startsAt.toISOString(),
                  totalCents: priced.totalCents,
                  depositCents: priced.depositCents,
                },
              },
              ctx,
            ),
          });

          return booking.id;
        },
        { timeout: 15_000, maxWait: 15_000 },
      )
      .catch((error: unknown) => {
        // The lock makes this unlikely, but the constraint is the guarantee.
        if (isExclusionViolation(error)) throw slotError('BOOKED');
        throw error;
      }),
  );

  return getBookingDetail(userId, bookingId, now);
}

/** Everything successfully paid towards this booking. */
const paidOf = (row: DetailRow): number =>
  row.payments
    .filter((payment) => payment.status === 'SUCCESSFUL')
    .reduce((sum, payment) => sum + payment.amountCents, 0);

function cancellationState(
  row: Pick<DetailRow, 'status' | 'startsAt'>,
  rules: BookingRules,
  now: Date,
  refundableCents: number,
): BookingCancellation {
  const freeUntil =
    rules.cancellationWindowHours === null
      ? null
      : new Date(row.startsAt.getTime() - rules.cancellationWindowHours * HOUR_MS);
  const free = freeUntil === null || now <= freeUntil;

  const base = {
    free,
    freeUntil: freeUntil?.toISOString() ?? null,
    refundableCents: free ? refundableCents : 0,
  };

  if (!LIVE_STATUSES.includes(row.status)) {
    return { ...base, allowed: false, reason: 'This booking is already closed.' };
  }
  if (row.startsAt <= now) {
    return { ...base, allowed: false, reason: 'This session has already started.' };
  }

  return { ...base, allowed: true, reason: null };
}

function rescheduleState(
  row: Pick<DetailRow, 'status' | 'startsAt'>,
  rules: BookingRules,
  now: Date,
): { allowed: boolean; reason: string | null } {
  if (!LIVE_STATUSES.includes(row.status)) {
    return { allowed: false, reason: 'This booking is already closed.' };
  }
  if (row.startsAt <= now) {
    return { allowed: false, reason: 'This session has already started.' };
  }
  if (rules.cancellationWindowHours !== null) {
    const until = new Date(row.startsAt.getTime() - rules.cancellationWindowHours * HOUR_MS);
    if (now > until) {
      return {
        allowed: false,
        reason: `Sessions can be moved up to ${rules.cancellationWindowHours} hours before they start. Contact the studio.`,
      };
    }
  }
  return { allowed: true, reason: null };
}

function toHistory(row: DetailRow, userId: string): BookingStatusEvent[] {
  return row.statusHistory.map((event) => ({
    status: event.toStatus,
    previousStatus: event.fromStatus,
    reason: event.reason,
    at: event.createdAt.toISOString(),
    byYou: event.actorId === userId,
  }));
}

function toItems(row: DetailRow): BookingItemLine[] {
  return row.items.map((item) => ({
    id: item.id,
    kind: item.kind,
    label: item.label,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    totalCents: item.totalCents,
  }));
}

async function refundedSoFar(bookingId: string): Promise<number> {
  const held = await prisma.refund.aggregate({
    where: { payment: { bookingId }, status: { in: [...REFUND_HELD_STATUSES] } },
    _sum: { amountCents: true },
  });
  return held._sum.amountCents ?? 0;
}

export async function getBookingDetail(
  userId: string,
  bookingId: string,
  now = new Date(),
): Promise<BookingDetail> {
  const row = await prisma.booking.findFirst({
    where: { id: bookingId, customerId: userId },
    select: DETAIL_SELECT,
  });
  // A booking that is not the caller's is indistinguishable from one that does
  // not exist.
  if (!row) throw ApiError.notFound('Booking');

  const [rules, refunded] = await Promise.all([getBookingRules(), refundedSoFar(row.id)]);

  const paidCents = paidOf(row);
  const refundableCents = Math.max(0, paidCents - refunded);

  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    studioName: row.studio.name,
    roomName: row.room.name,
    serviceName: row.service.name,
    totalCents: row.totalCents,
    paidCents,
    timezone: row.studio.timezone,
    serviceSlug: row.service.slug,
    roomSlug: row.room.slug,
    durationMinutes: minutesBetween(row.startsAt, row.endsAt),
    packageName: row.package?.name ?? null,
    notes: row.notes,
    subtotalCents: row.subtotalCents,
    taxCents: row.taxCents,
    depositCents: row.depositCents,
    balanceCents: Math.max(0, row.totalCents - paidCents),
    holdExpiresAt: row.holdExpiresAt?.toISOString() ?? null,
    requiresApproval: row.service.requiresApproval,
    createdAt: row.createdAt.toISOString(),
    items: toItems(row),
    history: toHistory(row, userId),
    payments: row.payments.map(toPayment),
    deliverables: row.deliverables.map(toDeliverable),
    cancellation: cancellationState(row, rules, now, refundableCents),
    reschedule: rescheduleState(row, rules, now),
    movedFromReference: row.rescheduledFrom?.reference ?? null,
    movedToReference: row.rescheduledTo?.reference ?? null,
  };
}

/**
 * Opens a refund request for everything still unrefunded on a booking.
 *
 * The portal records what is owed back; paying it out is a finance action, so
 * the rows are created `PENDING` rather than settled here.
 */
async function requestRefunds(
  tx: Prisma.TransactionClient,
  bookingId: string,
  reason: string,
  requestedById: string | null,
): Promise<number> {
  const payments = await tx.payment.findMany({
    where: { bookingId, status: 'SUCCESSFUL' },
    select: {
      id: true,
      amountCents: true,
      refunds: {
        where: { status: { in: [...REFUND_HELD_STATUSES] } },
        select: { amountCents: true },
      },
    },
  });

  let opened = 0;
  for (const payment of payments) {
    const already = payment.refunds.reduce((sum, refund) => sum + refund.amountCents, 0);
    const outstanding = payment.amountCents - already;
    if (outstanding <= 0) continue;

    await tx.refund.create({
      data: { paymentId: payment.id, amountCents: outstanding, reason, requestedById },
    });
    opened += 1;
  }
  return opened;
}

export async function cancelBooking(
  userId: string,
  bookingId: string,
  data: CancelBookingData,
  ctx: RequestContext,
  now = new Date(),
): Promise<BookingDetail> {
  const row = await prisma.booking.findFirst({
    where: { id: bookingId, customerId: userId },
    select: { id: true, status: true, startsAt: true, reference: true },
  });
  if (!row) throw ApiError.notFound('Booking');

  const [rules, refunded] = await Promise.all([getBookingRules(), refundedSoFar(row.id)]);
  const paid = await prisma.payment.aggregate({
    where: { bookingId: row.id, status: 'SUCCESSFUL' },
    _sum: { amountCents: true },
  });
  const state = cancellationState(
    row,
    rules,
    now,
    Math.max(0, (paid._sum.amountCents ?? 0) - refunded),
  );

  if (!state.allowed) {
    throw new ApiError(
      409,
      API_ERROR_CODES.INVALID_BOOKING_STATE,
      state.reason ?? 'This booking can no longer be cancelled.',
    );
  }

  await prisma.$transaction(async (tx) => {
    const changed = await tx.booking.updateMany({
      where: { id: row.id, customerId: userId, status: row.status },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancellationReason: data.reason ?? null,
        holdExpiresAt: null,
      },
    });
    // Something else moved the booking between the read and the write.
    if (changed.count !== 1) {
      throw ApiError.conflict(
        API_ERROR_CODES.INVALID_BOOKING_STATE,
        'This booking has just changed. Reload and try again.',
      );
    }

    await tx.bookingStatusHistory.create({
      data: {
        bookingId: row.id,
        fromStatus: row.status,
        toStatus: 'CANCELLED',
        actorId: userId,
        reason: data.reason ?? 'Cancelled by the customer',
      },
    });

    const refunds = state.free
      ? await requestRefunds(
          tx,
          row.id,
          'Booking cancelled within the free cancellation period',
          userId,
        )
      : 0;

    await tx.auditLog.create({
      data: auditRow(
        {
          action: 'booking.cancelled',
          entityType: 'booking',
          entityId: row.id,
          actorId: userId,
          after: { reference: row.reference, free: state.free, refundsOpened: refunds },
        },
        ctx,
      ),
    });
  });

  return getBookingDetail(userId, row.id, now);
}

/**
 * Moves a booking to a new slot.
 *
 * The old row is retired first, inside the same transaction, so a customer can
 * shift a session by half an hour without colliding with themselves. Payments
 * and deliverables follow the booking to its new row, so what has been paid is
 * never stranded on a superseded record.
 */
export async function rescheduleBooking(
  userId: string,
  bookingId: string,
  data: RescheduleBookingData,
  ctx: RequestContext,
  now = new Date(),
): Promise<BookingDetail> {
  const original = await prisma.booking.findFirst({
    where: { id: bookingId, customerId: userId },
    select: {
      id: true,
      reference: true,
      status: true,
      startsAt: true,
      notes: true,
      packageId: true,
      approvedById: true,
      approvedAt: true,
      service: { select: { slug: true, requiresApproval: true } },
    },
  });
  if (!original) throw ApiError.notFound('Booking');

  const rules = await getBookingRules();
  const state = rescheduleState(original, rules, now);
  if (!state.allowed) {
    throw new ApiError(
      409,
      API_ERROR_CODES.INVALID_BOOKING_STATE,
      state.reason ?? 'This booking can no longer be moved.',
    );
  }

  const request: BookingSlotData = {
    service: original.service.slug,
    room: data.room,
    startsAt: data.startsAt,
    durationMinutes: data.durationMinutes,
    ...(original.packageId ? { packageId: original.packageId } : {}),
  };

  const newBookingId = await withReference('BMD', (reference) =>
    prisma
      .$transaction(
        async (tx) => {
          const target = await loadBookingTarget(tx, request.service, request.room);
          await lockRoom(tx, target.room.id);

          // Retiring the old row first frees its slot, so a small shift in the
          // same room does not collide with the booking being moved.
          const retired = await tx.booking.updateMany({
            where: { id: original.id, customerId: userId, status: original.status },
            data: { status: 'RESCHEDULED', holdExpiresAt: null },
          });
          if (retired.count !== 1) {
            throw ApiError.conflict(
              API_ERROR_CODES.INVALID_BOOKING_STATE,
              'This booking has just changed. Reload and try again.',
            );
          }

          const slot = await checkSlot(tx, target, request, rules, now, {
            ignoreBookingId: original.id,
          });
          if (slot.blockedBy) throw slotError(slot.blockedBy);

          const priced = priceBooking(pricingInput(target, slot, rules));
          const paid = await tx.payment.aggregate({
            where: { bookingId: original.id, status: 'SUCCESSFUL' },
            _sum: { amountCents: true },
          });
          const paidCents = paid._sum.amountCents ?? 0;

          // An approval already given carries over; otherwise the new slot needs
          // the same decision the old one was waiting for.
          const status: BookingStatus =
            original.status === 'PENDING_APPROVAL'
              ? 'PENDING_APPROVAL'
              : paidCents >= priced.depositCents
                ? 'CONFIRMED'
                : 'PENDING_PAYMENT';

          const created = await tx.booking.create({
            data: {
              reference,
              customerId: userId,
              studioId: target.room.studio.id,
              roomId: target.room.id,
              serviceId: target.service.id,
              packageId: slot.package?.id ?? null,
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              blockedUntil: slot.blockedUntil,
              status,
              subtotalCents: priced.subtotalCents,
              taxCents: priced.taxCents,
              totalCents: priced.totalCents,
              depositCents: priced.depositCents,
              notes: original.notes,
              approvedById: original.approvedById,
              approvedAt: original.approvedAt,
              holdExpiresAt:
                status === 'PENDING_PAYMENT'
                  ? new Date(now.getTime() + rules.paymentHoldMinutes * 60_000)
                  : null,
              items: {
                create: priced.lines.map((line) => ({
                  kind: line.kind,
                  label: line.label,
                  serviceId: target.service.id,
                  quantity: line.quantity,
                  unitPriceCents: line.unitPriceCents,
                  totalCents: line.totalCents,
                })),
              },
              statusHistory: {
                create: {
                  toStatus: status,
                  actorId: userId,
                  reason: `Moved from ${original.reference}`,
                },
              },
            },
            select: { id: true },
          });

          await tx.booking.update({
            where: { id: original.id },
            data: { rescheduledToId: created.id },
          });

          await tx.bookingStatusHistory.create({
            data: {
              bookingId: original.id,
              fromStatus: original.status,
              toStatus: 'RESCHEDULED',
              actorId: userId,
              reason: `Moved to ${reference}`,
            },
          });

          // What has been paid belongs to the session, not to the row that first
          // recorded it.
          const movedPayments = await tx.payment.updateMany({
            where: { bookingId: original.id },
            data: { bookingId: created.id },
          });
          await tx.bookingDeliverable.updateMany({
            where: { bookingId: original.id },
            data: { bookingId: created.id },
          });

          await tx.auditLog.create({
            data: auditRow(
              {
                action: 'booking.rescheduled',
                entityType: 'booking',
                entityId: created.id,
                actorId: userId,
                after: {
                  from: original.reference,
                  to: reference,
                  startsAt: slot.startsAt.toISOString(),
                  paymentsMoved: movedPayments.count,
                },
              },
              ctx,
            ),
          });

          return created.id;
        },
        { timeout: 15_000, maxWait: 15_000 },
      )
      .catch((error: unknown) => {
        if (isExclusionViolation(error)) throw slotError('BOOKED');
        throw error;
      }),
  );

  return getBookingDetail(userId, newBookingId, now);
}

/**
 * Releases rooms held by bookings whose payment never arrived.
 *
 * A booking with a payment still in flight is left alone: the customer may be
 * staring at an M-Pesa prompt on their phone at that very moment.
 */
export async function expireBookingHolds(now = new Date()): Promise<{ expired: number }> {
  const due = await prisma.booking.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      holdExpiresAt: { lt: now },
      payments: { none: { status: { in: ['PENDING', 'PROCESSING'] } } },
    },
    select: { id: true, reference: true, customerId: true },
  });

  let expired = 0;

  for (const booking of due) {
    const changed = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.updateMany({
        where: { id: booking.id, status: 'PENDING_PAYMENT' },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancellationReason: 'Payment was not received in time',
          holdExpiresAt: null,
        },
      });
      if (result.count !== 1) return false;

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromStatus: 'PENDING_PAYMENT',
          toStatus: 'CANCELLED',
          reason: 'Payment was not received in time',
        },
      });
      await tx.auditLog.create({
        data: auditRow(
          {
            action: 'booking.hold_expired',
            entityType: 'booking',
            entityId: booking.id,
            after: { reference: booking.reference },
          },
          {},
        ),
      });
      return true;
    });

    if (changed) expired += 1;
  }

  return { expired };
}
