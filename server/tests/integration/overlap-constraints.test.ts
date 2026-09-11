/**
 * The double-booking guarantee (plan.md §4.2, risk R1).
 *
 * These tests run against a real PostgreSQL instance on purpose. The rule that
 * two customers cannot hold one room lives in an `EXCLUDE USING gist`
 * constraint, so a mocked database would assert nothing at all — it would only
 * confirm that the mock returns what the test told it to.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SQLSTATE, disconnectTestDb, sqlstateOf, testDb, truncateAll } from '../helpers/db.js';
import { getPostgresCode } from '../../src/lib/prisma.js';

const T = (iso: string): Date => new Date(iso);

/** A fixed reference window, well clear of "now" so clock drift is irrelevant. */
const WINDOW = {
  start: T('2026-10-01T10:00:00Z'),
  end: T('2026-10-01T12:00:00Z'),
};

let studioId: string;
let roomAId: string;
let roomBId: string;
let serviceId: string;
let customerId: string;

async function makeFixtures(): Promise<void> {
  const customer = await testDb.user.create({
    data: {
      email: 'overlap-customer@test.local',
      passwordHash: 'not-a-real-hash',
      firstName: 'Overlap',
      lastName: 'Customer',
      status: 'ACTIVE',
    },
  });
  customerId = customer.id;

  const studio = await testDb.studio.create({
    data: { name: 'Test Studio', slug: 'test-studio', timezone: 'Africa/Nairobi' },
  });
  studioId = studio.id;

  const roomA = await testDb.studioRoom.create({
    data: { studioId, name: 'Room A', slug: 'room-a', capacity: 4, hourlyRateCents: 350_000 },
  });
  roomAId = roomA.id;

  const roomB = await testDb.studioRoom.create({
    data: { studioId, name: 'Room B', slug: 'room-b', capacity: 2, hourlyRateCents: 250_000 },
  });
  roomBId = roomB.id;

  const category = await testDb.serviceCategory.create({
    data: { name: 'Podcast', slug: 'podcast' },
  });

  const service = await testDb.service.create({
    data: {
      categoryId: category.id,
      name: 'Podcast Recording',
      slug: 'podcast-recording',
      pricingModel: 'HOURLY',
      basePriceCents: 250_000,
    },
  });
  serviceId = service.id;
}

/** Builds a booking payload; every field the constraint cares about is explicit. */
function booking(overrides: {
  reference: string;
  roomId?: string;
  startsAt?: Date;
  endsAt?: Date;
  status?:
    | 'PENDING_PAYMENT'
    | 'PENDING_APPROVAL'
    | 'CONFIRMED'
    | 'IN_PROGRESS'
    | 'CANCELLED'
    | 'COMPLETED'
    | 'NO_SHOW';
}) {
  return {
    reference: overrides.reference,
    customerId,
    studioId,
    roomId: overrides.roomId ?? roomAId,
    serviceId,
    startsAt: overrides.startsAt ?? WINDOW.start,
    endsAt: overrides.endsAt ?? WINDOW.end,
    status: overrides.status ?? ('CONFIRMED' as const),
    subtotalCents: 500_000,
    totalCents: 500_000,
  };
}

beforeAll(async () => {
  await truncateAll();
});

beforeEach(async () => {
  await truncateAll();
  await makeFixtures();
});

afterAll(async () => {
  await truncateAll();
  await disconnectTestDb();
});

describe('bookings_no_overlap', () => {
  it('accepts the first booking for a room and window', async () => {
    const created = await testDb.booking.create({ data: booking({ reference: 'BMD-0001' }) });
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('CONFIRMED');
  });

  it('rejects a booking that overlaps a confirmed one in the same room', async () => {
    await testDb.booking.create({ data: booking({ reference: 'BMD-0001' }) });

    const code = await sqlstateOf(() =>
      testDb.booking.create({
        data: booking({
          reference: 'BMD-0002',
          startsAt: T('2026-10-01T11:00:00Z'),
          endsAt: T('2026-10-01T13:00:00Z'),
        }),
      }),
    );

    expect(code).toBe(SQLSTATE.EXCLUSION_VIOLATION);
    expect(await testDb.booking.count()).toBe(1);
  });

  it('rejects a booking wholly contained inside an existing one', async () => {
    await testDb.booking.create({ data: booking({ reference: 'BMD-0001' }) });

    const code = await sqlstateOf(() =>
      testDb.booking.create({
        data: booking({
          reference: 'BMD-0002',
          startsAt: T('2026-10-01T10:30:00Z'),
          endsAt: T('2026-10-01T11:00:00Z'),
        }),
      }),
    );

    expect(code).toBe(SQLSTATE.EXCLUSION_VIOLATION);
  });

  it('rejects a booking that wholly contains an existing one', async () => {
    await testDb.booking.create({ data: booking({ reference: 'BMD-0001' }) });

    const code = await sqlstateOf(() =>
      testDb.booking.create({
        data: booking({
          reference: 'BMD-0002',
          startsAt: T('2026-10-01T09:00:00Z'),
          endsAt: T('2026-10-01T13:00:00Z'),
        }),
      }),
    );

    expect(code).toBe(SQLSTATE.EXCLUSION_VIOLATION);
  });

  it('allows a booking that starts exactly when another ends', async () => {
    await testDb.booking.create({ data: booking({ reference: 'BMD-0001' }) });

    // The range is half-open, so 12:00–14:00 does not collide with 10:00–12:00.
    const created = await testDb.booking.create({
      data: booking({
        reference: 'BMD-0002',
        startsAt: WINDOW.end,
        endsAt: T('2026-10-01T14:00:00Z'),
      }),
    });

    expect(created.id).toBeTruthy();
    expect(await testDb.booking.count()).toBe(2);
  });

  it('allows the same window in a different room', async () => {
    await testDb.booking.create({ data: booking({ reference: 'BMD-0001' }) });
    const created = await testDb.booking.create({
      data: booking({ reference: 'BMD-0002', roomId: roomBId }),
    });

    expect(created.roomId).toBe(roomBId);
  });

  it.each(['PENDING_PAYMENT', 'PENDING_APPROVAL', 'IN_PROGRESS'] as const)(
    'treats a %s booking as holding the room',
    async (status) => {
      await testDb.booking.create({ data: booking({ reference: 'BMD-0001', status }) });

      const code = await sqlstateOf(() =>
        testDb.booking.create({ data: booking({ reference: 'BMD-0002' }) }),
      );

      expect(code).toBe(SQLSTATE.EXCLUSION_VIOLATION);
    },
  );

  it.each(['CANCELLED', 'COMPLETED', 'NO_SHOW'] as const)(
    'releases the slot once a booking is %s',
    async (status) => {
      await testDb.booking.create({ data: booking({ reference: 'BMD-0001', status }) });

      const created = await testDb.booking.create({ data: booking({ reference: 'BMD-0002' }) });
      expect(created.id).toBeTruthy();
    },
  );

  it('refuses to revive a cancelled booking into an occupied slot', async () => {
    const cancelled = await testDb.booking.create({
      data: booking({ reference: 'BMD-0001', status: 'CANCELLED' }),
    });
    await testDb.booking.create({ data: booking({ reference: 'BMD-0002' }) });

    // An UPDATE is checked by the constraint exactly as an INSERT is, so a
    // status change cannot smuggle a booking back into a taken slot.
    const code = await sqlstateOf(() =>
      testDb.booking.update({ where: { id: cancelled.id }, data: { status: 'CONFIRMED' } }),
    );

    expect(code).toBe(SQLSTATE.EXCLUSION_VIOLATION);
  });

  it('rejects a period that ends before it starts', async () => {
    const code = await sqlstateOf(() =>
      testDb.booking.create({
        data: booking({
          reference: 'BMD-0001',
          startsAt: T('2026-10-01T18:00:00Z'),
          endsAt: T('2026-10-01T17:00:00Z'),
        }),
      }),
    );

    expect(code).toBe(SQLSTATE.CHECK_VIOLATION);
  });

  it('rejects a zero-length period', async () => {
    const code = await sqlstateOf(() =>
      testDb.booking.create({
        data: booking({ reference: 'BMD-0001', startsAt: WINDOW.start, endsAt: WINDOW.start }),
      }),
    );

    expect(code).toBe(SQLSTATE.CHECK_VIOLATION);
  });
});

describe('bookings_no_overlap under concurrency', () => {
  it('lets exactly one of ten simultaneous identical requests win', async () => {
    // The scenario the constraint exists for: many application servers, one
    // room, the same instant. Nothing here is serialised in application code —
    // all ten inserts are issued at once and the database arbitrates.
    const attempts = Array.from({ length: 10 }, (_, index) =>
      testDb.booking.create({ data: booking({ reference: `BMD-RACE-${index}` }) }),
    );

    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);

    for (const failure of rejected) {
      expect(getPostgresCode(failure.reason)).toBe(SQLSTATE.EXCLUSION_VIOLATION);
    }

    expect(await testDb.booking.count()).toBe(1);
  });

  it('lets ten requests for ten different rooms all succeed', async () => {
    const rooms = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        testDb.studioRoom.create({
          data: {
            studioId,
            name: `Race Room ${index}`,
            slug: `race-room-${index}`,
            hourlyRateCents: 100_000,
          },
        }),
      ),
    );

    const results = await Promise.allSettled(
      rooms.map((room, index) =>
        testDb.booking.create({
          data: booking({ reference: `BMD-PAR-${index}`, roomId: room.id }),
        }),
      ),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(10);
  });
});

describe('equipment_rental_items_no_overlap', () => {
  let equipmentId: string;

  beforeEach(async () => {
    const category = await testDb.equipmentCategory.create({
      data: { name: 'Microphones', slug: 'microphones' },
    });
    const unit = await testDb.equipment.create({
      data: {
        categoryId: category.id,
        name: 'Shure SM7B',
        assetTag: 'TEST-MIC-001',
        dailyRateCents: 150_000,
      },
    });
    equipmentId = unit.id;
  });

  async function rental(reference: string, status: 'APPROVED' | 'CANCELLED' | 'RETURNED') {
    return testDb.equipmentRental.create({
      data: {
        reference,
        customerId,
        startsAt: WINDOW.start,
        endsAt: T('2026-10-03T10:00:00Z'),
        status,
        subtotalCents: 300_000,
        totalCents: 300_000,
      },
    });
  }

  it('rejects the same unit going out twice over overlapping windows', async () => {
    const first = await rental('RNT-0001', 'APPROVED');
    const second = await rental('RNT-0002', 'APPROVED');

    await testDb.equipmentRentalItem.create({
      data: {
        rentalId: first.id,
        equipmentId,
        startsAt: WINDOW.start,
        endsAt: T('2026-10-03T10:00:00Z'),
        unitRateCents: 150_000,
        totalCents: 300_000,
      },
    });

    const code = await sqlstateOf(() =>
      testDb.equipmentRentalItem.create({
        data: {
          rentalId: second.id,
          equipmentId,
          startsAt: T('2026-10-02T10:00:00Z'),
          endsAt: T('2026-10-04T10:00:00Z'),
          unitRateCents: 150_000,
          totalCents: 300_000,
        },
      }),
    );

    expect(code).toBe(SQLSTATE.EXCLUSION_VIOLATION);
  });

  it('mirrors the parent rental status onto items and frees the unit on cancel', async () => {
    const first = await rental('RNT-0001', 'APPROVED');
    const second = await rental('RNT-0002', 'APPROVED');

    const item = await testDb.equipmentRentalItem.create({
      data: {
        rentalId: first.id,
        equipmentId,
        startsAt: WINDOW.start,
        endsAt: T('2026-10-03T10:00:00Z'),
        unitRateCents: 150_000,
        totalCents: 300_000,
      },
    });

    // The insert trigger inherits the parent's status rather than the default.
    expect(item.rentalStatus).toBe('APPROVED');

    await testDb.equipmentRental.update({
      where: { id: first.id },
      data: { status: 'CANCELLED' },
    });

    const mirrored = await testDb.equipmentRentalItem.findUniqueOrThrow({
      where: { id: item.id },
    });
    expect(mirrored.rentalStatus).toBe('CANCELLED');

    // With the first rental cancelled, the unit is free for the same window.
    const replacement = await testDb.equipmentRentalItem.create({
      data: {
        rentalId: second.id,
        equipmentId,
        startsAt: WINDOW.start,
        endsAt: T('2026-10-03T10:00:00Z'),
        unitRateCents: 150_000,
        totalCents: 300_000,
      },
    });

    expect(replacement.id).toBeTruthy();
  });
});

describe('show_occurrences_no_overlap', () => {
  let showId: string;

  beforeEach(async () => {
    const show = await testDb.show.create({
      data: { name: 'Morning Drive', slug: 'morning-drive' },
    });
    showId = show.id;
  });

  it('rejects two airings claiming the same room at the same time', async () => {
    await testDb.showOccurrence.create({
      data: { showId, roomId: roomAId, startsAt: WINDOW.start, endsAt: WINDOW.end },
    });

    const code = await sqlstateOf(() =>
      testDb.showOccurrence.create({
        data: {
          showId,
          roomId: roomAId,
          startsAt: T('2026-10-01T11:00:00Z'),
          endsAt: T('2026-10-01T13:00:00Z'),
        },
      }),
    );

    expect(code).toBe(SQLSTATE.EXCLUSION_VIOLATION);
  });

  it('allows overlapping airings when neither occupies a room', async () => {
    await testDb.showOccurrence.create({
      data: { showId, roomId: null, startsAt: WINDOW.start, endsAt: WINDOW.end },
    });

    // A roomless airing conflicts with nobody, so the constraint skips it.
    const created = await testDb.showOccurrence.create({
      data: { showId, roomId: null, startsAt: WINDOW.start, endsAt: WINDOW.end },
    });

    expect(created.id).toBeTruthy();
  });

  it('frees the room once an airing is cancelled', async () => {
    await testDb.showOccurrence.create({
      data: {
        showId,
        roomId: roomAId,
        startsAt: WINDOW.start,
        endsAt: WINDOW.end,
        status: 'CANCELLED',
      },
    });

    const created = await testDb.showOccurrence.create({
      data: { showId, roomId: roomAId, startsAt: WINDOW.start, endsAt: WINDOW.end },
    });

    expect(created.status).toBe('SCHEDULED');
  });

  it('keeps occurrence expansion idempotent for a schedule and start time', async () => {
    const schedule = await testDb.showSchedule.create({
      data: {
        showId,
        roomId: roomBId,
        weekdays: [1, 2, 3],
        startMinute: 360,
        endMinute: 600,
        validFrom: T('2026-01-01T00:00:00Z'),
      },
    });

    await testDb.showOccurrence.create({
      data: {
        showId,
        scheduleId: schedule.id,
        roomId: roomBId,
        startsAt: WINDOW.start,
        endsAt: WINDOW.end,
      },
    });

    // Re-running the expansion job must not create a second airing.
    const code = await sqlstateOf(() =>
      testDb.showOccurrence.create({
        data: {
          showId,
          scheduleId: schedule.id,
          roomId: roomBId,
          startsAt: WINDOW.start,
          endsAt: WINDOW.end,
        },
      }),
    );

    expect(code).toBe(SQLSTATE.UNIQUE_VIOLATION);
  });
});

describe('monetary invariants', () => {
  it('rejects a payment with a non-positive amount', async () => {
    const code = await sqlstateOf(() =>
      testDb.payment.create({
        data: {
          reference: 'PAY-0001',
          customerId,
          provider: 'MPESA',
          amountCents: 0,
          idempotencyKey: 'idem-0001',
        },
      }),
    );

    expect(code).toBe(SQLSTATE.CHECK_VIOLATION);
  });

  it('rejects a second payment reusing an idempotency key', async () => {
    await testDb.payment.create({
      data: {
        reference: 'PAY-0001',
        customerId,
        provider: 'MPESA',
        amountCents: 500_000,
        idempotencyKey: 'idem-shared',
      },
    });

    const code = await sqlstateOf(() =>
      testDb.payment.create({
        data: {
          reference: 'PAY-0002',
          customerId,
          provider: 'MPESA',
          amountCents: 500_000,
          idempotencyKey: 'idem-shared',
        },
      }),
    );

    expect(code).toBe(SQLSTATE.UNIQUE_VIOLATION);
  });

  it('rejects a replayed provider callback for the same transaction', async () => {
    const payment = await testDb.payment.create({
      data: {
        reference: 'PAY-0001',
        customerId,
        provider: 'MPESA',
        amountCents: 500_000,
        idempotencyKey: 'idem-0001',
      },
    });

    const callback = {
      paymentId: payment.id,
      kind: 'CALLBACK' as const,
      provider: 'MPESA' as const,
      providerRef: 'ws_CO_123456789',
      rawPayload: { ResultCode: 0 },
      signatureVerified: true,
    };

    await testDb.paymentTransaction.create({ data: callback });

    // R4: a duplicate or replayed callback must not credit the booking twice.
    const code = await sqlstateOf(() => testDb.paymentTransaction.create({ data: callback }));

    expect(code).toBe(SQLSTATE.UNIQUE_VIOLATION);
  });
});
