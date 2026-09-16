/**
 * The booking engine: what is free, what it costs, and who may take it.
 *
 * These run against a real PostgreSQL instance because the rule that two
 * customers cannot hold one room is an exclusion constraint, not application
 * code. The concurrency test here is the one that proves the whole design: ten
 * identical requests, one booking.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  API_PREFIX,
  type AvailabilityDay,
  type BookingDetail,
  type BookingQuote,
} from '@bmd/shared';
import { createApp } from '../../src/app.js';
import { expireBookingHolds } from '../../src/services/booking.service.js';
import { shiftZonedDay, zonedDay, zonedTime, type ZonedDay } from '../../src/lib/time.js';
import { registerCustomer, type SignedIn } from '../helpers/auth.js';
import { disconnectTestDb, testDb, truncateAll } from '../helpers/db.js';

const app = createApp();
const TZ = 'Africa/Nairobi';
const MINUTE = 60_000;
const KES = (shillings: number): number => shillings * 100;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A studio day `offset` days from today, so tests never depend on a fixed date. */
const dayAhead = (offset: number): ZonedDay => shiftZonedDay(zonedDay(new Date(), TZ), offset, TZ);

/** The instant at which the studio clock reads `hour:minute` on that day. */
const at = (day: ZonedDay, hour: number, minute = 0): Date =>
  zonedTime(day.year, day.month, day.day, hour * 60 + minute, TZ);

let sequence = 0;
const nextId = (prefix: string): string => {
  sequence += 1;
  return `${prefix}-${String(sequence).padStart(6, '0')}`;
};

interface Fixtures {
  studioId: string;
  roomId: string;
  serviceId: string;
  packageId: string;
}

/**
 * One studio open every day 08:00–20:00, so a test can use any date without
 * first working out which weekday it lands on. Closed days are tested by
 * closing one deliberately.
 */
async function makeStudio(): Promise<Fixtures> {
  const studio = await testDb.studio.create({
    data: { name: 'B.M.D Studio', slug: 'bmd', timezone: TZ },
  });

  await testDb.operatingHour.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      studioId: studio.id,
      weekday,
      openMinute: 8 * 60,
      closeMinute: 20 * 60,
    })),
  });

  const room = await testDb.studioRoom.create({
    data: {
      studioId: studio.id,
      name: 'Podcast Studio A',
      slug: 'podcast-a',
      hourlyRateCents: KES(2500),
      bufferMinutes: 15,
    },
  });
  const otherRoom = await testDb.studioRoom.create({
    data: {
      studioId: studio.id,
      name: 'Podcast Studio B',
      slug: 'podcast-b',
      hourlyRateCents: KES(1800),
      bufferMinutes: 0,
    },
  });

  const category = await testDb.serviceCategory.create({
    data: { name: 'Podcast', slug: 'podcast' },
  });

  const service = await testDb.service.create({
    data: {
      categoryId: category.id,
      name: 'Podcast Recording',
      slug: 'podcast-recording',
      pricingModel: 'HOURLY',
      basePriceCents: KES(2500),
      minDurationMin: 60,
      maxDurationMin: 300,
      slotIntervalMin: 30,
      bufferMinutes: 0,
      rooms: { create: [{ roomId: room.id }, { roomId: otherRoom.id }] },
    },
  });

  // Reached by slug from the tests that need approval behaviour.
  await testDb.service.create({
    data: {
      categoryId: category.id,
      name: 'Live Radio Slot',
      slug: 'live-radio-slot',
      pricingModel: 'HOURLY',
      basePriceCents: KES(3500),
      minDurationMin: 60,
      maxDurationMin: 240,
      slotIntervalMin: 30,
      requiresApproval: true,
      rooms: { create: { roomId: room.id } },
    },
  });

  const packageService = await testDb.service.create({
    data: {
      categoryId: category.id,
      name: 'Studio Portrait Session',
      slug: 'studio-portrait',
      pricingModel: 'PACKAGE',
      basePriceCents: KES(12000),
      minDurationMin: 60,
      maxDurationMin: 240,
      slotIntervalMin: 60,
      rooms: { create: { roomId: otherRoom.id } },
    },
  });

  const portraitPackage = await testDb.photographyPackage.create({
    data: {
      serviceId: packageService.id,
      name: 'Portrait — Extended',
      deliverableCount: 25,
      editTurnaroundDays: 7,
      priceCents: KES(22000),
    },
  });

  await testDb.setting.createMany({
    data: [
      { key: 'tax.vat_percent', value: 16 },
      { key: 'booking.deposit_percent', value: 50 },
      { key: 'booking.cancellation_window_hours', value: 24 },
      { key: 'booking.max_advance_days', value: 90 },
      { key: 'booking.payment_hold_minutes', value: 30 },
    ],
  });

  return {
    studioId: studio.id,
    roomId: room.id,
    serviceId: service.id,
    packageId: portraitPackage.id,
  };
}

let fixtures: Fixtures;

/** A booking written straight to the database, bypassing the engine. */
function seedBooking(options: {
  customerId: string;
  startsAt: Date;
  endsAt: Date;
  blockedUntil?: Date;
  status?: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED';
  totalCents?: number;
  depositCents?: number;
  holdExpiresAt?: Date | null;
  roomId?: string;
}) {
  const totalCents = options.totalCents ?? KES(5000);
  return testDb.booking.create({
    data: {
      reference: nextId('BMD'),
      customerId: options.customerId,
      studioId: fixtures.studioId,
      roomId: options.roomId ?? fixtures.roomId,
      serviceId: fixtures.serviceId,
      startsAt: options.startsAt,
      endsAt: options.endsAt,
      blockedUntil: options.blockedUntil ?? options.endsAt,
      status: options.status ?? 'CONFIRMED',
      subtotalCents: totalCents,
      totalCents,
      depositCents: options.depositCents ?? 0,
      holdExpiresAt: options.holdExpiresAt ?? null,
    },
  });
}

function seedPayment(options: {
  customerId: string;
  bookingId: string;
  amountCents: number;
  status?: 'SUCCESSFUL' | 'PENDING';
}) {
  const status = options.status ?? 'SUCCESSFUL';
  return testDb.payment.create({
    data: {
      reference: nextId('PAY'),
      idempotencyKey: nextId('KEY'),
      customerId: options.customerId,
      bookingId: options.bookingId,
      provider: 'MPESA',
      purpose: 'BOOKING',
      status,
      amountCents: options.amountCents,
      ...(status === 'SUCCESSFUL' ? { paidAt: new Date(), receiptNumber: nextId('RCP') } : {}),
    },
  });
}

const availabilityFor = (date: string, duration = 60, room = 'podcast-a') =>
  request(app)
    .get(`${API_PREFIX}/availability`)
    .query({ service: 'podcast-recording', room, date, duration });

const bookingBody = (startsAt: Date, durationMinutes = 60) => ({
  service: 'podcast-recording',
  room: 'podcast-a',
  startsAt: startsAt.toISOString(),
  durationMinutes,
  acceptTerms: true,
});

const book = (customer: SignedIn, startsAt: Date, durationMinutes = 60) =>
  request(app)
    .post(`${API_PREFIX}/me/bookings`)
    .set(bearer(customer.accessToken))
    .send(bookingBody(startsAt, durationMinutes));

const slotAt = (day: AvailabilityDay, iso: string) =>
  day.slots.find((slot) => slot.startsAt === iso);

beforeEach(async () => {
  await truncateAll();
  fixtures = await makeStudio();
});

afterAll(async () => {
  await truncateAll();
  await disconnectTestDb();
});

describe('GET /availability', () => {
  it('offers the day on the slot grid, and marks what is taken including turnaround', async () => {
    const day = dayAhead(7);
    const customer = await registerCustomer(app);
    await seedBooking({
      customerId: customer.session.user.id,
      startsAt: at(day, 10),
      endsAt: at(day, 12),
      // 15 minutes of turnaround after the session.
      blockedUntil: new Date(at(day, 12).getTime() + 15 * MINUTE),
    });

    const res = await availabilityFor(day.date);
    expect(res.status).toBe(200);
    const data = res.body.data as AvailabilityDay;

    expect(data.isOpen).toBe(true);
    expect(data.timezone).toBe(TZ);
    expect(data.slots[0]?.startsAt).toBe(at(day, 8).toISOString());
    // Last start that still ends by 20:00.
    expect(data.slots.at(-1)?.startsAt).toBe(at(day, 19).toISOString());

    expect(slotAt(data, at(day, 9, 30).toISOString())).toMatchObject({
      available: false,
      blockedBy: 'BOOKED',
    });
    expect(slotAt(data, at(day, 10).toISOString())?.blockedBy).toBe('BOOKED');
    // 12:00–13:00 would start inside the turnaround that follows the booking.
    expect(slotAt(data, at(day, 12).toISOString())?.blockedBy).toBe('BOOKED');
    expect(slotAt(data, at(day, 12, 30).toISOString())?.available).toBe(true);
  });

  it('reports a closed day rather than an empty grid', async () => {
    const day = dayAhead(7);
    await testDb.operatingHour.update({
      where: { studioId_weekday: { studioId: fixtures.studioId, weekday: day.weekday } },
      data: { isClosed: true },
    });

    const data = (await availabilityFor(day.date)).body.data as AvailabilityDay;

    expect(data.isOpen).toBe(false);
    expect(data.closedReason).toBe('CLOSED');
    expect(data.slots).toEqual([]);
  });

  it('refuses dates beyond the studio’s booking window', async () => {
    const data = (await availabilityFor(dayAhead(120).date)).body.data as AvailabilityDay;

    expect(data.closedReason).toBe('BEYOND_BOOKING_WINDOW');
  });

  it('closes slots covered by a blackout', async () => {
    const day = dayAhead(7);
    await testDb.blackoutPeriod.create({
      data: {
        studioId: fixtures.studioId,
        startsAt: at(day, 14),
        endsAt: at(day, 16),
        reason: 'MAINTENANCE',
      },
    });

    const data = (await availabilityFor(day.date)).body.data as AvailabilityDay;

    expect(slotAt(data, at(day, 14).toISOString())?.blockedBy).toBe('BLACKOUT');
    expect(slotAt(data, at(day, 15, 30).toISOString())?.blockedBy).toBe('BLACKOUT');
    expect(slotAt(data, at(day, 16).toISOString())?.available).toBe(true);
  });

  it('closes slots where a show is due on air in that room', async () => {
    const day = dayAhead(7);
    const show = await testDb.show.create({ data: { name: 'Morning Drive', slug: 'morning' } });
    await testDb.showOccurrence.create({
      data: {
        showId: show.id,
        roomId: fixtures.roomId,
        startsAt: at(day, 9),
        endsAt: at(day, 10),
      },
    });

    const data = (await availabilityFor(day.date)).body.data as AvailabilityDay;

    expect(slotAt(data, at(day, 9).toISOString())?.blockedBy).toBe('ON_AIR');
    expect(slotAt(data, at(day, 10).toISOString())?.available).toBe(true);
  });

  it('does not offer slots that have already passed today', async () => {
    const today = dayAhead(0);
    const data = (await availabilityFor(today.date)).body.data as AvailabilityDay;

    for (const slot of data.slots) {
      if (new Date(slot.startsAt) <= new Date()) expect(slot.blockedBy).toBe('IN_THE_PAST');
    }
  });

  it('refuses a session length the service does not offer', async () => {
    const res = await availabilityFor(dayAhead(7).date, 45);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path).toBe('durationMinutes');
  });

  it('does not reveal a service and room pairing that is not offered', async () => {
    const res = await request(app)
      .get(`${API_PREFIX}/availability`)
      .query({
        service: 'studio-portrait',
        room: 'podcast-a',
        date: dayAhead(7).date,
        duration: 60,
      });

    expect(res.status).toBe(404);
  });
});

describe('POST /bookings/quote', () => {
  it('prices an hourly session with VAT and a deposit, in whole shillings', async () => {
    const day = dayAhead(7);
    const res = await request(app)
      .post(`${API_PREFIX}/bookings/quote`)
      .send({
        service: 'podcast-recording',
        room: 'podcast-a',
        startsAt: at(day, 10).toISOString(),
        durationMinutes: 90,
      });

    expect(res.status).toBe(200);
    const quote = res.body.data as BookingQuote;

    expect(quote.subtotalCents).toBe(KES(3750));
    expect(quote.taxCents).toBe(KES(600));
    expect(quote.totalCents).toBe(KES(4350));
    expect(quote.depositCents).toBe(KES(2175));
    expect(quote.requiresApproval).toBe(false);
    expect(quote.available).toBe(true);
    expect(quote.cancellationWindowHours).toBe(24);
  });

  it('charges the chosen package, and insists on one', async () => {
    const day = dayAhead(7);
    const body = {
      service: 'studio-portrait',
      room: 'podcast-b',
      startsAt: at(day, 10).toISOString(),
      durationMinutes: 120,
    };

    const without = await request(app).post(`${API_PREFIX}/bookings/quote`).send(body);
    expect(without.status).toBe(400);
    expect(without.body.error.details[0].path).toBe('packageId');

    const withPackage = await request(app)
      .post(`${API_PREFIX}/bookings/quote`)
      .send({ ...body, packageId: fixtures.packageId });

    expect(withPackage.status).toBe(200);
    const quote = withPackage.body.data as BookingQuote;
    expect(quote.subtotalCents).toBe(KES(22000));
    expect(quote.packageName).toBe('Portrait — Extended');
  });

  it('says when a slot is already taken instead of failing', async () => {
    const day = dayAhead(7);
    const customer = await registerCustomer(app);
    await seedBooking({
      customerId: customer.session.user.id,
      startsAt: at(day, 10),
      endsAt: at(day, 12),
    });

    const res = await request(app)
      .post(`${API_PREFIX}/bookings/quote`)
      .send({
        service: 'podcast-recording',
        room: 'podcast-a',
        startsAt: at(day, 10).toISOString(),
        durationMinutes: 60,
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ available: false, blockedBy: 'BOOKED' });
  });
});

describe('POST /me/bookings', () => {
  it('requires a signed-in account', async () => {
    const res = await request(app)
      .post(`${API_PREFIX}/me/bookings`)
      .send(bookingBody(at(dayAhead(7), 10)));

    expect(res.status).toBe(401);
  });

  it('refuses an account without permission to book', async () => {
    const customer = await registerCustomer(app);
    await testDb.userRole.deleteMany({ where: { userId: customer.session.user.id } });

    const res = await book(customer, at(dayAhead(7), 10));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('creates a booking that holds the room until its deposit is paid', async () => {
    const day = dayAhead(7);
    const customer = await registerCustomer(app);

    const res = await book(customer, at(day, 10), 90);

    expect(res.status).toBe(201);
    const booking = res.body.data as BookingDetail;

    expect(booking.status).toBe('PENDING_PAYMENT');
    expect(booking.reference).toMatch(/^BMD-[0-9A-Z]{6}$/);
    expect(booking.totalCents).toBe(KES(4350));
    expect(booking.depositCents).toBe(KES(2175));
    expect(booking.balanceCents).toBe(KES(4350));
    expect(booking.paidCents).toBe(0);
    expect(booking.holdExpiresAt).not.toBeNull();
    expect(booking.items).toHaveLength(1);
    expect(booking.history).toEqual([
      expect.objectContaining({ status: 'PENDING_PAYMENT', previousStatus: null, byYou: true }),
    ]);
    expect(booking.cancellation.allowed).toBe(true);
    expect(booking.cancellation.free).toBe(true);

    // The room is held: the same slot is no longer on offer.
    const day7 = (await availabilityFor(day.date, 90)).body.data as AvailabilityDay;
    expect(slotAt(day7, at(day, 10).toISOString())?.blockedBy).toBe('BOOKED');

    const stored = await testDb.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stored.blockedUntil?.toISOString()).toBe(
      new Date(at(day, 11, 30).getTime() + 15 * MINUTE).toISOString(),
    );

    const audit = await testDb.auditLog.findFirst({ where: { action: 'booking.created' } });
    expect(audit?.entityId).toBe(booking.id);
  });

  it('ignores a total supplied by the client', async () => {
    const customer = await registerCustomer(app);

    const res = await request(app)
      .post(`${API_PREFIX}/me/bookings`)
      .set(bearer(customer.accessToken))
      .send({ ...bookingBody(at(dayAhead(7), 10)), totalCents: 1, depositCents: 1 });

    expect(res.status).toBe(201);
    expect((res.body.data as BookingDetail).totalCents).toBe(KES(2900));
  });

  it('waits for staff when the service needs approval', async () => {
    const customer = await registerCustomer(app);

    const res = await request(app)
      .post(`${API_PREFIX}/me/bookings`)
      .set(bearer(customer.accessToken))
      .send({
        service: 'live-radio-slot',
        room: 'podcast-a',
        startsAt: at(dayAhead(7), 10).toISOString(),
        durationMinutes: 60,
        acceptTerms: true,
      });

    expect(res.status).toBe(201);
    const booking = res.body.data as BookingDetail;
    expect(booking.status).toBe('PENDING_APPROVAL');
    // Staff decide in their own time; the hold is theirs, not the clock's.
    expect(booking.holdExpiresAt).toBeNull();
  });

  it('confirms at once when no deposit is required', async () => {
    await testDb.setting.update({
      where: { key: 'booking.deposit_percent' },
      data: { value: 0 },
    });
    const customer = await registerCustomer(app);

    const res = await book(customer, at(dayAhead(7), 10));

    expect((res.body.data as BookingDetail).status).toBe('CONFIRMED');
  });

  it('refuses a slot someone else already holds', async () => {
    const day = dayAhead(7);
    const first = await registerCustomer(app);
    const second = await registerCustomer(app);
    await book(first, at(day, 10), 120);

    const res = await book(second, at(day, 11));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('keeps the turnaround between sessions free', async () => {
    const day = dayAhead(7);
    const first = await registerCustomer(app);
    const second = await registerCustomer(app);
    await book(first, at(day, 10), 120);

    // 12:00 is free of the session but inside its 15-minute turnaround.
    const res = await book(second, at(day, 12));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');

    const after = await book(second, at(day, 12, 30));
    expect(after.status).toBe(201);
  });

  it('refuses a session outside opening hours', async () => {
    const customer = await registerCustomer(app);

    const early = await book(customer, at(dayAhead(7), 7));
    expect(early.status).toBe(400);
    expect(early.body.error.code).toBe('OUTSIDE_OPERATING_HOURS');

    const late = await book(customer, at(dayAhead(7), 19, 30), 60);
    expect(late.status).toBe(400);
    expect(late.body.error.code).toBe('OUTSIDE_OPERATING_HOURS');
  });

  it('refuses a start that is not on the slot grid', async () => {
    const customer = await registerCustomer(app);

    const res = await book(customer, at(dayAhead(7), 10, 15));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OUTSIDE_OPERATING_HOURS');
  });

  it('refuses a session during a blackout, and says why', async () => {
    const day = dayAhead(7);
    await testDb.blackoutPeriod.create({
      data: {
        studioId: fixtures.studioId,
        roomId: fixtures.roomId,
        startsAt: at(day, 9),
        endsAt: at(day, 17),
        reason: 'MAINTENANCE',
      },
    });
    const customer = await registerCustomer(app);

    const res = await book(customer, at(day, 10));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BLACKOUT_PERIOD');
  });

  it('refuses a time that has already passed', async () => {
    const customer = await registerCustomer(app);
    const yesterday = dayAhead(-1);

    const res = await book(customer, at(yesterday, 10));

    expect(res.status).toBe(400);
  });

  it('lets exactly one of ten simultaneous requests take the slot', async () => {
    const day = dayAhead(8);
    const customers = await Promise.all(Array.from({ length: 10 }, () => registerCustomer(app)));

    const results = await Promise.all(customers.map((customer) => book(customer, at(day, 14), 60)));

    const created = results.filter((res) => res.status === 201);
    const refused = results.filter((res) => res.status === 409);

    expect(created).toHaveLength(1);
    expect(refused).toHaveLength(9);
    for (const res of refused) {
      expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
    }
    expect(await testDb.booking.count()).toBe(1);
  });
});

describe('GET /me/bookings/:id', () => {
  it('shows a booking to its owner and nobody else', async () => {
    const owner = await registerCustomer(app);
    const stranger = await registerCustomer(app);
    const created = await book(owner, at(dayAhead(7), 10));
    const { id } = created.body.data as BookingDetail;

    const mine = await request(app)
      .get(`${API_PREFIX}/me/bookings/${id}`)
      .set(bearer(owner.accessToken));
    expect(mine.status).toBe(200);

    const theirs = await request(app)
      .get(`${API_PREFIX}/me/bookings/${id}`)
      .set(bearer(stranger.accessToken));
    // Not 403: whether the booking exists at all is none of their business.
    expect(theirs.status).toBe(404);
  });
});

describe('POST /me/bookings/:id/cancel', () => {
  it('cancels, frees the room and opens a refund inside the free window', async () => {
    const day = dayAhead(7);
    const customer = await registerCustomer(app);
    const created = await book(customer, at(day, 10));
    const booking = created.body.data as BookingDetail;
    await seedPayment({
      customerId: customer.session.user.id,
      bookingId: booking.id,
      amountCents: KES(1450),
    });

    const res = await request(app)
      .post(`${API_PREFIX}/me/bookings/${booking.id}/cancel`)
      .set(bearer(customer.accessToken))
      .send({ reason: 'Plans changed' });

    expect(res.status).toBe(200);
    const cancelled = res.body.data as BookingDetail;
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.history.at(-1)).toMatchObject({
      status: 'CANCELLED',
      reason: 'Plans changed',
    });

    const refunds = await testDb.refund.findMany();
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ amountCents: KES(1450), status: 'PENDING' });

    // The slot is immediately available again.
    const data = (await availabilityFor(day.date)).body.data as AvailabilityDay;
    expect(slotAt(data, at(day, 10).toISOString())?.available).toBe(true);
  });

  it('cancels without a refund once the free window has passed', async () => {
    const customer = await registerCustomer(app);
    // Two hours from now, inside the 24-hour cancellation window.
    const soon = new Date(Date.now() + 2 * 60 * MINUTE);
    const booking = await seedBooking({
      customerId: customer.session.user.id,
      startsAt: soon,
      endsAt: new Date(soon.getTime() + 60 * MINUTE),
    });
    await seedPayment({
      customerId: customer.session.user.id,
      bookingId: booking.id,
      amountCents: KES(2000),
    });

    const res = await request(app)
      .post(`${API_PREFIX}/me/bookings/${booking.id}/cancel`)
      .set(bearer(customer.accessToken))
      .send({});

    expect(res.status).toBe(200);
    expect((res.body.data as BookingDetail).status).toBe('CANCELLED');
    expect(await testDb.refund.count()).toBe(0);
  });

  it('refuses to cancel a session that has already started', async () => {
    const customer = await registerCustomer(app);
    const started = new Date(Date.now() - 30 * MINUTE);
    const booking = await seedBooking({
      customerId: customer.session.user.id,
      startsAt: started,
      endsAt: new Date(started.getTime() + 60 * MINUTE),
    });

    const res = await request(app)
      .post(`${API_PREFIX}/me/bookings/${booking.id}/cancel`)
      .set(bearer(customer.accessToken))
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_BOOKING_STATE');
  });
});

describe('POST /me/bookings/:id/reschedule', () => {
  it('moves the session, retires the old row and carries the payments across', async () => {
    const day = dayAhead(7);
    const customer = await registerCustomer(app);
    const created = await book(customer, at(day, 10));
    const original = created.body.data as BookingDetail;
    await seedPayment({
      customerId: customer.session.user.id,
      bookingId: original.id,
      amountCents: KES(1450),
    });

    const res = await request(app)
      .post(`${API_PREFIX}/me/bookings/${original.id}/reschedule`)
      .set(bearer(customer.accessToken))
      // Half an hour later in the same room: it overlaps the booking being
      // moved, which only works because the old row is retired first.
      .send({
        room: 'podcast-a',
        startsAt: at(day, 10, 30).toISOString(),
        durationMinutes: 60,
      });

    expect(res.status).toBe(200);
    const moved = res.body.data as BookingDetail;
    expect(moved.id).not.toBe(original.id);
    expect(moved.startsAt).toBe(at(day, 10, 30).toISOString());
    expect(moved.paidCents).toBe(KES(1450));
    expect(moved.movedFromReference).toBe(original.reference);

    const old = await testDb.booking.findUniqueOrThrow({ where: { id: original.id } });
    expect(old.status).toBe('RESCHEDULED');
    expect(old.rescheduledToId).toBe(moved.id);

    const payments = await testDb.payment.findMany({ select: { bookingId: true } });
    expect(payments).toEqual([{ bookingId: moved.id }]);
  });

  it('refuses to move a session once the free window has passed', async () => {
    const customer = await registerCustomer(app);
    const soon = new Date(Date.now() + 2 * 60 * MINUTE);
    const booking = await seedBooking({
      customerId: customer.session.user.id,
      startsAt: soon,
      endsAt: new Date(soon.getTime() + 60 * MINUTE),
    });

    const res = await request(app)
      .post(`${API_PREFIX}/me/bookings/${booking.id}/reschedule`)
      .set(bearer(customer.accessToken))
      .send({
        room: 'podcast-a',
        startsAt: at(dayAhead(9), 10).toISOString(),
        durationMinutes: 60,
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_BOOKING_STATE');
  });
});

describe('the hold sweep', () => {
  it('releases a room when the payment never arrives', async () => {
    const day = dayAhead(7);
    const customer = await registerCustomer(app);
    const lapsed = await seedBooking({
      customerId: customer.session.user.id,
      startsAt: at(day, 10),
      endsAt: at(day, 11),
      status: 'PENDING_PAYMENT',
      depositCents: KES(1450),
      holdExpiresAt: new Date(Date.now() - MINUTE),
    });

    const result = await expireBookingHolds();

    expect(result.expired).toBe(1);
    const after = await testDb.booking.findUniqueOrThrow({ where: { id: lapsed.id } });
    expect(after.status).toBe('CANCELLED');
    expect(after.cancellationReason).toBe('Payment was not received in time');

    const history = await testDb.bookingStatusHistory.findFirst({
      where: { bookingId: lapsed.id, toStatus: 'CANCELLED' },
    });
    expect(history?.actorId).toBeNull();
  });

  it('leaves a booking alone while its payment is still in flight', async () => {
    const day = dayAhead(7);
    const customer = await registerCustomer(app);
    const held = await seedBooking({
      customerId: customer.session.user.id,
      startsAt: at(day, 10),
      endsAt: at(day, 11),
      status: 'PENDING_PAYMENT',
      holdExpiresAt: new Date(Date.now() - MINUTE),
    });
    await seedPayment({
      customerId: customer.session.user.id,
      bookingId: held.id,
      amountCents: KES(1450),
      status: 'PENDING',
    });

    const result = await expireBookingHolds();

    expect(result.expired).toBe(0);
    const after = await testDb.booking.findUniqueOrThrow({ where: { id: held.id } });
    expect(after.status).toBe('PENDING_PAYMENT');
  });
});
