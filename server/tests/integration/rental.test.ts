/**
 * Equipment hire: what is free over a window, what it costs, and which
 * physical unit goes out.
 *
 * Run against a real PostgreSQL instance because the rule that one unit cannot
 * be in two places at once is an exclusion constraint on
 * `equipment_rental_items`, not application code.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  API_PREFIX,
  type EquipmentAvailability,
  type HireQuote,
  type RentalDetail,
} from '@bmd/shared';
import { createApp } from '../../src/app.js';
import { shiftZonedDay, zonedDay, type ZonedDay } from '../../src/lib/time.js';
import { registerCustomer, type SignedIn } from '../helpers/auth.js';
import { disconnectTestDb, testDb, truncateAll } from '../helpers/db.js';

const app = createApp();
const TZ = 'Africa/Nairobi';
const KES = (shillings: number): number => shillings * 100;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const dayAhead = (offset: number): ZonedDay => shiftZonedDay(zonedDay(new Date(), TZ), offset, TZ);

let studioId: string;

/** Two identical microphones, one camera, one damaged unit, one in the shop. */
async function makeFleet(): Promise<void> {
  const studio = await testDb.studio.create({
    data: { name: 'B.M.D Studio', slug: 'bmd', timezone: TZ },
  });
  studioId = studio.id;

  await testDb.operatingHour.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      studioId: studio.id,
      weekday,
      openMinute: 8 * 60,
      closeMinute: 20 * 60,
    })),
  });

  const mics = await testDb.equipmentCategory.create({
    data: { name: 'Microphones', slug: 'microphones' },
  });
  const cameras = await testDb.equipmentCategory.create({
    data: { name: 'Cameras', slug: 'cameras' },
  });

  await testDb.equipment.createMany({
    data: [
      {
        categoryId: mics.id,
        name: 'Shure SM7B',
        assetTag: 'BMD-MIC-001',
        dailyRateCents: KES(1500),
        depositCents: KES(10000),
      },
      {
        categoryId: mics.id,
        name: 'Shure SM7B',
        assetTag: 'BMD-MIC-002',
        dailyRateCents: KES(1500),
        depositCents: KES(10000),
      },
      {
        categoryId: mics.id,
        name: 'Shure SM7B',
        assetTag: 'BMD-MIC-003',
        dailyRateCents: KES(1500),
        depositCents: KES(10000),
        condition: 'DAMAGED',
      },
      {
        categoryId: cameras.id,
        name: 'Sony A7 III',
        assetTag: 'BMD-CAM-001',
        dailyRateCents: KES(6000),
        depositCents: KES(50000),
      },
      {
        categoryId: cameras.id,
        name: 'Canon EOS R6',
        assetTag: 'BMD-CAM-002',
        dailyRateCents: KES(6500),
        depositCents: KES(55000),
        status: 'MAINTENANCE',
      },
    ],
  });

  await testDb.setting.createMany({
    data: [
      { key: 'tax.vat_percent', value: 16 },
      { key: 'booking.cancellation_window_hours', value: 24 },
      { key: 'booking.max_advance_days', value: 90 },
    ],
  });
}

const availabilityFor = (from: string, to: string) =>
  request(app).get(`${API_PREFIX}/equipment/availability`).query({ from, to });

async function keysFor(from: string, to: string): Promise<Record<string, string>> {
  const res = await availabilityFor(from, to);
  const data = res.body.data as EquipmentAvailability;
  return Object.fromEntries(data.items.map((item) => [item.name, item.key]));
}

const hire = (
  customer: SignedIn,
  body: { from: string; to: string; items: Array<{ key: string; quantity: number }> },
) =>
  request(app)
    .post(`${API_PREFIX}/me/rentals`)
    .set(bearer(customer.accessToken))
    .send({ ...body, acceptTerms: true });

beforeEach(async () => {
  await truncateAll();
  await makeFleet();
});

afterAll(async () => {
  await truncateAll();
  await disconnectTestDb();
});

describe('GET /equipment/availability', () => {
  it('counts the units that could actually go out', async () => {
    const from = dayAhead(3).date;
    const to = dayAhead(4).date;

    const res = await availabilityFor(from, to);

    expect(res.status).toBe(200);
    const data = res.body.data as EquipmentAvailability;
    expect(data.days).toBe(2);
    expect(data.closedOn).toEqual([]);

    const mic = data.items.find((item) => item.name === 'Shure SM7B');
    // Three microphones exist; the damaged one is never offered.
    expect(mic).toMatchObject({ unitCount: 3, availableCount: 2, dailyRateCents: KES(1500) });

    const canon = data.items.find((item) => item.name === 'Canon EOS R6');
    expect(canon?.availableCount).toBe(0);
  });

  it('offers nothing when the studio is shut on a handover day', async () => {
    const from = dayAhead(3);
    await testDb.operatingHour.update({
      where: { studioId_weekday: { studioId, weekday: from.weekday } },
      data: { isClosed: true },
    });

    const data = (await availabilityFor(from.date, dayAhead(4).date)).body
      .data as EquipmentAvailability;

    expect(data.closedOn).toEqual([from.date]);
    for (const item of data.items) expect(item.availableCount).toBe(0);
  });

  it('refuses a window that ends before it starts', async () => {
    const res = await availabilityFor(dayAhead(5).date, dayAhead(3).date);

    expect(res.status).toBe(400);
  });
});

describe('POST /equipment/hire-quote', () => {
  it('charges the daily rate for every day, adds VAT, and holds a deposit', async () => {
    const from = dayAhead(3).date;
    const to = dayAhead(4).date;
    const keys = await keysFor(from, to);

    const res = await request(app)
      .post(`${API_PREFIX}/equipment/hire-quote`)
      .send({ from, to, items: [{ key: keys['Shure SM7B'], quantity: 2 }] });

    expect(res.status).toBe(200);
    const quote = res.body.data as HireQuote;

    // 2 microphones × 2 days × KES 1,500.
    expect(quote.subtotalCents).toBe(KES(6000));
    expect(quote.taxCents).toBe(KES(960));
    // Deposits are refundable, so they are never taxed.
    expect(quote.depositCents).toBe(KES(20000));
    expect(quote.totalCents).toBe(KES(26960));
    expect(quote.available).toBe(true);
  });

  it('says which items cannot be filled rather than failing', async () => {
    const from = dayAhead(3).date;
    const to = dayAhead(3).date;
    const keys = await keysFor(from, to);

    const res = await request(app)
      .post(`${API_PREFIX}/equipment/hire-quote`)
      .send({ from, to, items: [{ key: keys['Shure SM7B'], quantity: 3 }] });

    expect(res.status).toBe(200);
    const quote = res.body.data as HireQuote;
    expect(quote.available).toBe(false);
    expect(quote.unavailableKeys).toEqual([keys['Shure SM7B']]);
    expect(quote.lines[0]).toMatchObject({ quantity: 3, availableCount: 2 });
  });

  it('refuses an item that is not in the catalogue', async () => {
    const res = await request(app)
      .post(`${API_PREFIX}/equipment/hire-quote`)
      .send({
        from: dayAhead(3).date,
        to: dayAhead(3).date,
        items: [{ key: 'not-a-real-product-000-000', quantity: 1 }],
      });

    expect(res.status).toBe(400);
  });
});

describe('POST /me/rentals', () => {
  it('requires a signed-in account', async () => {
    const res = await request(app)
      .post(`${API_PREFIX}/me/rentals`)
      .send({ from: dayAhead(3).date, to: dayAhead(3).date, items: [], acceptTerms: true });

    expect(res.status).toBe(401);
  });

  it('refuses an account without permission to hire', async () => {
    const from = dayAhead(3).date;
    const keys = await keysFor(from, from);
    const customer = await registerCustomer(app);
    await testDb.userRole.deleteMany({ where: { userId: customer.session.user.id } });

    const res = await hire(customer, {
      from,
      to: from,
      items: [{ key: keys['Shure SM7B'], quantity: 1 }],
    });

    expect(res.status).toBe(403);
  });

  it('reserves real units and waits for staff to approve', async () => {
    const from = dayAhead(3).date;
    const to = dayAhead(4).date;
    const keys = await keysFor(from, to);
    const customer = await registerCustomer(app);

    const res = await hire(customer, {
      from,
      to,
      items: [{ key: keys['Shure SM7B'], quantity: 2 }],
    });

    expect(res.status).toBe(201);
    const rental = res.body.data as RentalDetail;

    expect(rental.status).toBe('PENDING_APPROVAL');
    expect(rental.reference).toMatch(/^HIRE-[0-9A-Z]{6}$/);
    expect(rental.days).toBe(2);
    expect(rental.totalCents).toBe(KES(26960));
    expect(rental.depositCents).toBe(KES(20000));
    expect(rental.balanceCents).toBe(KES(26960));
    expect(rental.lines).toEqual([
      expect.objectContaining({ name: 'Shure SM7B', quantity: 2, totalCents: KES(6000) }),
    ]);

    // Two distinct units were actually allocated, and neither is the damaged one.
    const items = await testDb.equipmentRentalItem.findMany({
      select: { equipmentId: true, equipment: { select: { assetTag: true, condition: true } } },
    });
    expect(new Set(items.map((item) => item.equipmentId)).size).toBe(2);
    for (const item of items) expect(item.equipment.condition).not.toBe('DAMAGED');

    // The shelf is now empty for that window.
    const after = (await availabilityFor(from, to)).body.data as EquipmentAvailability;
    expect(after.items.find((item) => item.name === 'Shure SM7B')?.availableCount).toBe(0);

    const audit = await testDb.auditLog.findFirst({ where: { action: 'rental.requested' } });
    expect(audit?.entityId).toBe(rental.id);
  });

  it('refuses a hire the fleet cannot fill', async () => {
    const from = dayAhead(3).date;
    const keys = await keysFor(from, from);
    const customer = await registerCustomer(app);

    const res = await hire(customer, {
      from,
      to: from,
      items: [{ key: keys['Shure SM7B'], quantity: 3 }],
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EQUIPMENT_UNAVAILABLE');
    expect(await testDb.equipmentRental.count()).toBe(0);
  });

  it('refuses a handover on a day the studio is shut', async () => {
    const from = dayAhead(3);
    const keys = await keysFor(from.date, from.date);
    await testDb.operatingHour.update({
      where: { studioId_weekday: { studioId, weekday: from.weekday } },
      data: { isClosed: true },
    });
    const customer = await registerCustomer(app);

    const res = await hire(customer, {
      from: from.date,
      to: from.date,
      items: [{ key: keys['Shure SM7B'], quantity: 1 }],
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BLACKOUT_PERIOD');
  });

  it('gives the last camera to exactly one of two simultaneous requests', async () => {
    const from = dayAhead(5).date;
    const to = dayAhead(6).date;
    const keys = await keysFor(from, to);
    const [first, second] = await Promise.all([registerCustomer(app), registerCustomer(app)]);

    const results = await Promise.all([
      hire(first, { from, to, items: [{ key: keys['Sony A7 III'], quantity: 1 }] }),
      hire(second, { from, to, items: [{ key: keys['Sony A7 III'], quantity: 1 }] }),
    ]);

    expect(results.filter((res) => res.status === 201)).toHaveLength(1);
    expect(results.filter((res) => res.status === 409)).toHaveLength(1);
    expect(await testDb.equipmentRental.count()).toBe(1);
  });
});

describe('a customer’s own hire', () => {
  it('is visible to its owner and nobody else', async () => {
    const from = dayAhead(3).date;
    const keys = await keysFor(from, from);
    const owner = await registerCustomer(app);
    const stranger = await registerCustomer(app);
    const created = await hire(owner, {
      from,
      to: from,
      items: [{ key: keys['Shure SM7B'], quantity: 1 }],
    });
    const { id } = created.body.data as RentalDetail;

    const mine = await request(app)
      .get(`${API_PREFIX}/me/rentals/${id}`)
      .set(bearer(owner.accessToken));
    expect(mine.status).toBe(200);

    const theirs = await request(app)
      .get(`${API_PREFIX}/me/rentals/${id}`)
      .set(bearer(stranger.accessToken));
    expect(theirs.status).toBe(404);
  });

  it('frees its units again when cancelled, and asks for the money back', async () => {
    const from = dayAhead(3).date;
    const to = dayAhead(4).date;
    const keys = await keysFor(from, to);
    const customer = await registerCustomer(app);
    const created = await hire(customer, {
      from,
      to,
      items: [{ key: keys['Shure SM7B'], quantity: 2 }],
    });
    const rental = created.body.data as RentalDetail;

    await testDb.payment.create({
      data: {
        reference: 'PAY-HIRE-1',
        idempotencyKey: 'key-hire-1',
        customerId: customer.session.user.id,
        rentalId: rental.id,
        provider: 'MPESA',
        purpose: 'RENTAL',
        status: 'SUCCESSFUL',
        amountCents: KES(26960),
        paidAt: new Date(),
        receiptNumber: 'RCP-HIRE-1',
      },
    });

    const res = await request(app)
      .post(`${API_PREFIX}/me/rentals/${rental.id}/cancel`)
      .set(bearer(customer.accessToken))
      .send({ reason: 'Shoot postponed' });

    expect(res.status).toBe(200);
    expect((res.body.data as RentalDetail).status).toBe('CANCELLED');

    const refunds = await testDb.refund.findMany();
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ amountCents: KES(26960), status: 'PENDING' });

    const after = (await availabilityFor(from, to)).body.data as EquipmentAvailability;
    expect(after.items.find((item) => item.name === 'Shure SM7B')?.availableCount).toBe(2);
  });

  it('cannot be cancelled online once the equipment has gone out', async () => {
    const from = dayAhead(3).date;
    const keys = await keysFor(from, from);
    const customer = await registerCustomer(app);
    const created = await hire(customer, {
      from,
      to: from,
      items: [{ key: keys['Shure SM7B'], quantity: 1 }],
    });
    const rental = created.body.data as RentalDetail;

    await testDb.equipmentRental.update({
      where: { id: rental.id },
      data: { status: 'CHECKED_OUT', checkedOutAt: new Date() },
    });

    const res = await request(app)
      .post(`${API_PREFIX}/me/rentals/${rental.id}/cancel`)
      .set(bearer(customer.accessToken))
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_BOOKING_STATE');
  });
});
