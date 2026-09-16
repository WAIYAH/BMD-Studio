import type { Prisma, PrismaClient } from '@prisma/client';
import {
  API_ERROR_CODES,
  OPEN_RENTAL_STATUSES,
  type BookingCancellation,
  type CancelRentalData,
  type CreateRentalData,
  type EquipmentAvailability,
  type EquipmentAvailabilityItem,
  type HireQuote,
  type HireQuoteData,
  type RentalDetail,
  type RentalItemLine,
} from '@bmd/shared';
import { env } from '../config/env.js';
import { ApiError } from '../lib/api-error.js';
import { auditRow, type RequestContext } from '../lib/audit.js';
import { priceHire, type PriceHireLine } from '../lib/pricing.js';
import { isExclusionViolation, prisma } from '../lib/prisma.js';
import { withReference } from '../lib/references.js';
import { shiftZonedDay, zonedDay, zonedTime, type ZonedDay } from '../lib/time.js';
import { PAYMENT_SELECT, toPayment } from './account.service.js';
import { productKey } from './equipment-catalogue.service.js';
import { getBookingRules, type BookingRules } from './policy.service.js';

/**
 * Equipment hire for the signed-in customer.
 *
 * Equipment is collected and returned in opening hours, so a hire runs from
 * opening time on its first day to closing time on its last, and is charged by
 * whole studio days. Which physical unit goes out is decided here, never by the
 * customer, and `equipment_rental_items_no_overlap` in PostgreSQL is what makes
 * it impossible to send the same unit out twice.
 */

type DbClient = PrismaClient | Prisma.TransactionClient;

const OPEN = [...OPEN_RENTAL_STATUSES];
const DAY_MS = 86_400_000;

/** A hire longer than this is a conversation with the studio, not a web form. */
const MAX_HIRE_DAYS = 60;

const REFUND_HELD_STATUSES = ['PENDING', 'PROCESSING', 'SUCCESSFUL'] as const;

const UNIT_SELECT = {
  id: true,
  name: true,
  manufacturer: true,
  model: true,
  dailyRateCents: true,
  depositCents: true,
  status: true,
  condition: true,
  assetTag: true,
} satisfies Prisma.EquipmentSelect;

type UnitRow = Prisma.EquipmentGetPayload<{ select: typeof UNIT_SELECT }>;

interface HireWindow {
  from: ZonedDay;
  to: ZonedDay;
  /** Opening time on the first day. */
  startsAt: Date;
  /** Closing time on the last day. */
  endsAt: Date;
  days: number;
  timezone: string;
  /** Days in the window on which the studio is closed, as `YYYY-MM-DD`. */
  closedOn: string[];
}

function dayFromDate(date: string, timezone: string): ZonedDay {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    throw ApiError.badRequest('That is not a valid date.', [
      { path: 'from', message: 'Use the format YYYY-MM-DD.' },
    ]);
  }
  return zonedDay(zonedTime(year, month, day, 12 * 60, timezone), timezone);
}

/**
 * Turns two calendar dates into the instants the equipment leaves and comes
 * back, using the studio's opening hours.
 */
async function resolveHireWindow(
  client: DbClient,
  from: string,
  to: string,
  rules: BookingRules,
  now: Date,
): Promise<HireWindow> {
  const studio = await client.studio.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, timezone: true },
  });
  if (!studio) {
    throw new ApiError(
      503,
      API_ERROR_CODES.INTEGRATION_NOT_CONFIGURED,
      'No studio is configured for equipment hire.',
    );
  }

  const timezone = studio.timezone;
  const fromDay = dayFromDate(from, timezone);
  const toDay = dayFromDate(to, timezone);

  if (toDay.date < fromDay.date) {
    throw ApiError.badRequest('The return date cannot be before the collection date.', [
      { path: 'to', message: 'Choose a later return date.' },
    ]);
  }

  const today = zonedDay(now, timezone);
  if (fromDay.date < today.date) {
    throw ApiError.badRequest('That collection date has passed.', [
      { path: 'from', message: 'Choose today or a later date.' },
    ]);
  }

  if (rules.maxAdvanceDays !== null) {
    const last = shiftZonedDay(today, rules.maxAdvanceDays, timezone);
    if (fromDay.date > last.date) {
      throw ApiError.badRequest(
        `Equipment can be booked up to ${rules.maxAdvanceDays} days ahead.`,
        [{ path: 'from', message: 'Choose an earlier date.' }],
      );
    }
  }

  const days = Math.round((toDay.start.getTime() - fromDay.start.getTime()) / DAY_MS) + 1;
  if (days > MAX_HIRE_DAYS) {
    throw ApiError.badRequest(`A hire can run for at most ${MAX_HIRE_DAYS} days.`, [
      { path: 'to', message: 'Choose a shorter hire, or contact the studio.' },
    ]);
  }

  const hours = await client.operatingHour.findMany({
    where: { studioId: studio.id },
    select: { weekday: true, openMinute: true, closeMinute: true, isClosed: true },
  });
  const byWeekday = new Map(hours.map((row) => [row.weekday, row]));

  const openOn = (day: ZonedDay) => {
    const row = byWeekday.get(day.weekday);
    return row && !row.isClosed && row.closeMinute > row.openMinute ? row : null;
  };

  // Equipment can only change hands when someone is there to hand it over.
  const closedOn = [fromDay, toDay].filter((day) => !openOn(day)).map((day) => day.date);

  const collection = openOn(fromDay);
  const returnDay = openOn(toDay);

  return {
    from: fromDay,
    to: toDay,
    startsAt: zonedTime(
      fromDay.year,
      fromDay.month,
      fromDay.day,
      collection?.openMinute ?? 0,
      timezone,
    ),
    endsAt: zonedTime(
      toDay.year,
      toDay.month,
      toDay.day,
      returnDay?.closeMinute ?? 24 * 60,
      timezone,
    ),
    days,
    timezone,
    closedOn: [...new Set(closedOn)],
  };
}

/** A unit that could go out at all, regardless of this window. */
const isHireable = (unit: Pick<UnitRow, 'status' | 'condition'>): boolean =>
  unit.status !== 'RETIRED' && unit.status !== 'MAINTENANCE' && unit.condition !== 'DAMAGED';

/** Units already spoken for over a window, by rental or by maintenance. */
async function unavailableUnitIds(
  client: DbClient,
  startsAt: Date,
  endsAt: Date,
): Promise<Set<string>> {
  const [rented, underRepair] = await Promise.all([
    client.equipmentRentalItem.findMany({
      where: {
        rentalStatus: { in: OPEN },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { equipmentId: true },
    }),
    client.equipmentMaintenance.findMany({
      where: {
        startsAt: { lt: endsAt },
        // An open-ended ticket blocks everything from its start onwards.
        OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
      },
      select: { equipmentId: true },
    }),
  ]);

  return new Set([
    ...rented.map((row) => row.equipmentId),
    ...underRepair.map((row) => row.equipmentId),
  ]);
}

interface Product {
  key: string;
  name: string;
  dailyRateCents: number;
  depositCents: number;
  unitCount: number;
  /** Unit ids free for the whole window, in a stable order. */
  free: string[];
}

/** Every product in the fleet with the units free across one window. */
async function productsFor(client: DbClient, window: HireWindow): Promise<Map<string, Product>> {
  const [units, busy] = await Promise.all([
    client.equipment.findMany({
      where: { status: { not: 'RETIRED' } },
      orderBy: [{ name: 'asc' }, { assetTag: 'asc' }],
      select: UNIT_SELECT,
    }),
    unavailableUnitIds(client, window.startsAt, window.endsAt),
  ]);

  const products = new Map<string, Product>();

  for (const unit of units) {
    const key = productKey(unit);
    const product = products.get(key) ?? {
      key,
      name: unit.name,
      dailyRateCents: unit.dailyRateCents,
      depositCents: unit.depositCents,
      unitCount: 0,
      free: [],
    };

    product.unitCount += 1;
    if (isHireable(unit) && !busy.has(unit.id)) product.free.push(unit.id);
    products.set(key, product);
  }

  return products;
}

export async function getEquipmentAvailability(
  from: string,
  to: string,
  now = new Date(),
): Promise<EquipmentAvailability> {
  const rules = await getBookingRules();
  const window = await resolveHireWindow(prisma, from, to, rules, now);
  const products = await productsFor(prisma, window);

  const items: EquipmentAvailabilityItem[] = [...products.values()].map((product) => ({
    key: product.key,
    name: product.name,
    unitCount: product.unitCount,
    // Nothing can go out on a day the studio is shut.
    availableCount: window.closedOn.length > 0 ? 0 : product.free.length,
    dailyRateCents: product.dailyRateCents,
    depositCents: product.depositCents,
  }));

  return {
    from: window.from.date,
    to: window.to.date,
    days: window.days,
    timezone: window.timezone,
    closedOn: window.closedOn,
    items,
  };
}

/** Requested items priced against what is actually free. */
function buildQuote(
  data: HireQuoteData,
  window: HireWindow,
  products: Map<string, Product>,
  rules: BookingRules,
): HireQuote {
  const requested: Array<PriceHireLine & { availableCount: number }> = data.items.map((item) => {
    const product = products.get(item.key);
    if (!product) {
      throw ApiError.badRequest('That item is not in the hire catalogue.', [
        { path: 'items', message: `Unknown item: ${item.key}` },
      ]);
    }
    return {
      key: product.key,
      label: product.name,
      quantity: item.quantity,
      dailyRateCents: product.dailyRateCents,
      depositCents: product.depositCents,
      availableCount: window.closedOn.length > 0 ? 0 : product.free.length,
    };
  });

  const priced = priceHire({
    lines: requested.map(({ availableCount: _availableCount, ...line }) => line),
    days: window.days,
    vatPercent: rules.vatPercent,
  });

  const lines = priced.lines.map((line, index) => ({
    key: line.key,
    label: line.label,
    quantity: line.quantity,
    availableCount: requested[index]?.availableCount ?? 0,
    dailyRateCents: line.dailyRateCents,
    totalCents: line.totalCents,
    depositCents: line.depositCents,
  }));

  const unavailableKeys = lines
    .filter((line) => line.availableCount < line.quantity)
    .map((line) => line.key);

  return {
    from: window.from.date,
    to: window.to.date,
    days: window.days,
    timezone: window.timezone,
    lines,
    subtotalCents: priced.subtotalCents,
    taxCents: priced.taxCents,
    depositCents: priced.depositCents,
    totalCents: priced.totalCents,
    vatPercent: rules.vatPercent,
    available: unavailableKeys.length === 0 && window.closedOn.length === 0,
    unavailableKeys,
    closedOn: window.closedOn,
  };
}

export async function quoteHire(data: HireQuoteData, now = new Date()): Promise<HireQuote> {
  const rules = await getBookingRules();
  const window = await resolveHireWindow(prisma, data.from, data.to, rules, now);
  const products = await productsFor(prisma, window);
  return buildQuote(data, window, products, rules);
}

/**
 * Serialises requests for the same products, so two customers asking for the
 * last camera at the same instant queue instead of racing. Keys are locked in a
 * fixed order, which is what stops two such requests deadlocking each other.
 */
async function lockProducts(tx: Prisma.TransactionClient, keys: string[]): Promise<void> {
  for (const key of [...keys].sort()) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
  }
}

export async function createRental(
  userId: string,
  input: CreateRentalData,
  ctx: RequestContext,
  now = new Date(),
): Promise<RentalDetail> {
  const rules = await getBookingRules();

  const rentalId = await withReference('HIRE', (reference) =>
    prisma
      .$transaction(
        async (tx) => {
          const window = await resolveHireWindow(tx, input.from, input.to, rules, now);
          if (window.closedOn.length > 0) {
            throw ApiError.conflict(
              API_ERROR_CODES.BLACKOUT_PERIOD,
              `The studio is closed on ${window.closedOn.join(' and ')}, so equipment cannot change hands.`,
            );
          }

          await lockProducts(
            tx,
            input.items.map((item) => item.key),
          );

          const products = await productsFor(tx, window);
          const quote = buildQuote(input, window, products, rules);
          if (!quote.available) {
            throw ApiError.conflict(
              API_ERROR_CODES.EQUIPMENT_UNAVAILABLE,
              'Some of that equipment is not available for those dates.',
            );
          }

          // Which units go out is the studio's decision, taken here.
          const allocation = input.items.flatMap((item) => {
            const product = products.get(item.key);
            const units = product?.free.slice(0, item.quantity) ?? [];
            return units.map((equipmentId) => ({
              equipmentId,
              unitRateCents: product?.dailyRateCents ?? 0,
              totalCents: Math.round((product?.dailyRateCents ?? 0) * window.days),
            }));
          });

          const rental = await tx.equipmentRental.create({
            data: {
              reference,
              customerId: userId,
              startsAt: window.startsAt,
              endsAt: window.endsAt,
              status: 'PENDING_APPROVAL',
              subtotalCents: quote.subtotalCents,
              taxCents: quote.taxCents,
              depositCents: quote.depositCents,
              totalCents: quote.totalCents,
              notes: input.notes ?? null,
              items: {
                create: allocation.map((unit) => ({
                  equipmentId: unit.equipmentId,
                  startsAt: window.startsAt,
                  endsAt: window.endsAt,
                  quantity: 1,
                  unitRateCents: unit.unitRateCents,
                  totalCents: unit.totalCents,
                })),
              },
            },
            select: { id: true },
          });

          await tx.auditLog.create({
            data: auditRow(
              {
                action: 'rental.requested',
                entityType: 'equipment_rental',
                entityId: rental.id,
                actorId: userId,
                after: {
                  reference,
                  from: window.from.date,
                  to: window.to.date,
                  units: allocation.length,
                  totalCents: quote.totalCents,
                },
              },
              ctx,
            ),
          });

          return rental.id;
        },
        { timeout: 15_000, maxWait: 15_000 },
      )
      .catch((error: unknown) => {
        // The lock makes this unlikely; the constraint is the guarantee.
        if (isExclusionViolation(error)) {
          throw ApiError.conflict(
            API_ERROR_CODES.EQUIPMENT_UNAVAILABLE,
            'That equipment has just been taken for those dates.',
          );
        }
        throw error;
      }),
  );

  return getRentalDetail(userId, rentalId, now);
}

const DETAIL_SELECT = {
  id: true,
  reference: true,
  status: true,
  startsAt: true,
  endsAt: true,
  subtotalCents: true,
  taxCents: true,
  depositCents: true,
  lateFeeCents: true,
  damageFeeCents: true,
  totalCents: true,
  notes: true,
  createdAt: true,
  approvedAt: true,
  rejectedReason: true,
  checkedOutAt: true,
  returnedAt: true,
  items: {
    orderBy: { createdAt: 'asc' },
    select: {
      unitRateCents: true,
      totalCents: true,
      equipment: {
        select: {
          name: true,
          manufacturer: true,
          model: true,
          dailyRateCents: true,
          depositCents: true,
        },
      },
    },
  },
  payments: {
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    select: PAYMENT_SELECT,
  },
} satisfies Prisma.EquipmentRentalSelect;

type DetailRow = Prisma.EquipmentRentalGetPayload<{ select: typeof DETAIL_SELECT }>;

/** Individual units grouped back into the products the customer asked for. */
function toLines(row: DetailRow): RentalItemLine[] {
  const lines = new Map<string, RentalItemLine>();

  for (const item of row.items) {
    const key = productKey(item.equipment);
    const line = lines.get(key) ?? {
      key,
      name: item.equipment.name,
      quantity: 0,
      dailyRateCents: item.unitRateCents,
      totalCents: 0,
      depositCents: 0,
    };
    line.quantity += 1;
    line.totalCents += item.totalCents;
    line.depositCents += item.equipment.depositCents;
    lines.set(key, line);
  }

  return [...lines.values()];
}

function cancellationState(
  row: Pick<DetailRow, 'status' | 'startsAt'>,
  rules: BookingRules,
  now: Date,
  refundableCents: number,
): BookingCancellation {
  const freeUntil =
    rules.cancellationWindowHours === null
      ? null
      : new Date(row.startsAt.getTime() - rules.cancellationWindowHours * 3_600_000);
  const free = freeUntil === null || now <= freeUntil;

  const base = {
    free,
    freeUntil: freeUntil?.toISOString() ?? null,
    refundableCents: free ? refundableCents : 0,
  };

  // Once equipment has left the store, the studio needs it back rather than a
  // cancellation.
  if (row.status !== 'PENDING_APPROVAL' && row.status !== 'APPROVED') {
    return { ...base, allowed: false, reason: 'This hire can no longer be cancelled online.' };
  }
  if (row.startsAt <= now) {
    return { ...base, allowed: false, reason: 'This hire has already started.' };
  }

  return { ...base, allowed: true, reason: null };
}

export async function getRentalDetail(
  userId: string,
  rentalId: string,
  now = new Date(),
): Promise<RentalDetail> {
  const row = await prisma.equipmentRental.findFirst({
    where: { id: rentalId, customerId: userId },
    select: DETAIL_SELECT,
  });
  if (!row) throw ApiError.notFound('Equipment hire');

  const [rules, refunded, timezone] = await Promise.all([
    getBookingRules(),
    prisma.refund
      .aggregate({
        where: { payment: { rentalId }, status: { in: [...REFUND_HELD_STATUSES] } },
        _sum: { amountCents: true },
      })
      .then((result) => result._sum.amountCents ?? 0),
    getStudioTimezone(),
  ]);

  const paidCents = row.payments
    .filter((payment) => payment.status === 'SUCCESSFUL')
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  const lines = toLines(row);
  const days = Math.max(
    1,
    Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / DAY_MS) || 1,
  );

  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    totalCents: row.totalCents,
    paidCents,
    isOverdue: row.status === 'OVERDUE' || (row.status === 'CHECKED_OUT' && row.endsAt <= now),
    items: lines.map((line) => (line.quantity > 1 ? `${line.name} × ${line.quantity}` : line.name)),
    timezone: timezone ?? env.TIMEZONE,
    days,
    notes: row.notes,
    subtotalCents: row.subtotalCents,
    taxCents: row.taxCents,
    depositCents: row.depositCents,
    lateFeeCents: row.lateFeeCents,
    damageFeeCents: row.damageFeeCents,
    balanceCents: Math.max(0, row.totalCents - paidCents),
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedReason: row.rejectedReason,
    checkedOutAt: row.checkedOutAt?.toISOString() ?? null,
    returnedAt: row.returnedAt?.toISOString() ?? null,
    lines,
    payments: row.payments.map(toPayment),
    cancellation: cancellationState(row, rules, now, Math.max(0, paidCents - refunded)),
  };
}

async function getStudioTimezone(): Promise<string | null> {
  const studio = await prisma.studio.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { timezone: true },
  });
  return studio?.timezone ?? null;
}

export async function cancelRental(
  userId: string,
  rentalId: string,
  data: CancelRentalData,
  ctx: RequestContext,
  now = new Date(),
): Promise<RentalDetail> {
  const row = await prisma.equipmentRental.findFirst({
    where: { id: rentalId, customerId: userId },
    select: { id: true, reference: true, status: true, startsAt: true },
  });
  if (!row) throw ApiError.notFound('Equipment hire');

  const [rules, paid, refunded] = await Promise.all([
    getBookingRules(),
    prisma.payment
      .aggregate({
        where: { rentalId: row.id, status: 'SUCCESSFUL' },
        _sum: { amountCents: true },
      })
      .then((result) => result._sum.amountCents ?? 0),
    prisma.refund
      .aggregate({
        where: { payment: { rentalId: row.id }, status: { in: [...REFUND_HELD_STATUSES] } },
        _sum: { amountCents: true },
      })
      .then((result) => result._sum.amountCents ?? 0),
  ]);

  const state = cancellationState(row, rules, now, Math.max(0, paid - refunded));
  if (!state.allowed) {
    throw new ApiError(
      409,
      API_ERROR_CODES.INVALID_BOOKING_STATE,
      state.reason ?? 'This hire can no longer be cancelled.',
    );
  }

  await prisma.$transaction(async (tx) => {
    const changed = await tx.equipmentRental.updateMany({
      where: { id: row.id, customerId: userId, status: row.status },
      data: { status: 'CANCELLED' },
    });
    if (changed.count !== 1) {
      throw ApiError.conflict(
        API_ERROR_CODES.INVALID_BOOKING_STATE,
        'This hire has just changed. Reload and try again.',
      );
    }

    if (state.free) {
      const payments = await tx.payment.findMany({
        where: { rentalId: row.id, status: 'SUCCESSFUL' },
        select: {
          id: true,
          amountCents: true,
          refunds: {
            where: { status: { in: [...REFUND_HELD_STATUSES] } },
            select: { amountCents: true },
          },
        },
      });

      for (const payment of payments) {
        const already = payment.refunds.reduce((sum, refund) => sum + refund.amountCents, 0);
        const outstanding = payment.amountCents - already;
        if (outstanding <= 0) continue;
        await tx.refund.create({
          data: {
            paymentId: payment.id,
            amountCents: outstanding,
            reason: 'Equipment hire cancelled within the free cancellation period',
            requestedById: userId,
          },
        });
      }
    }

    await tx.auditLog.create({
      data: auditRow(
        {
          action: 'rental.cancelled',
          entityType: 'equipment_rental',
          entityId: row.id,
          actorId: userId,
          after: { reference: row.reference, free: state.free, reason: data.reason ?? null },
        },
        ctx,
      ),
    });
  });

  return getRentalDetail(userId, row.id, now);
}
