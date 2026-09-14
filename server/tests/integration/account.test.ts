/**
 * The signed-in customer area: dashboard, lists, notifications, profile,
 * password, signed-in devices and notification preferences.
 *
 * Every query is scoped to the caller in SQL, so what one customer can see of
 * another is proven against a real database rather than assumed.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  API_PREFIX,
  type AccountSession,
  type BookingStatusValue,
  type CustomerDashboard,
  type DashboardBooking,
  type DashboardDeliverable,
  type DashboardNotification,
  type DashboardRental,
  type NotificationPreference,
} from '@bmd/shared';
import { createApp } from '../../src/app.js';
import { PASSWORD, refreshCookieFrom, registerCustomer } from '../helpers/auth.js';
import { disconnectTestDb, testDb, truncateAll } from '../helpers/db.js';

const app = createApp();
const ME = `${API_PREFIX}/me`;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const fromNow = (ms: number) => new Date(Date.now() + ms);

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await truncateAll();
  await disconnectTestDb();
});

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${String(sequence).padStart(6, '0')}`;
}

async function makeCatalogue() {
  const studio = await testDb.studio.create({ data: { name: 'B.M.D Studio', slug: 'bmd' } });
  const room = await testDb.studioRoom.create({
    data: {
      studioId: studio.id,
      name: 'Podcast Studio A',
      slug: 'podcast-a',
      hourlyRateCents: 250_000,
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
      basePriceCents: 250_000,
    },
  });
  return { studioId: studio.id, roomId: room.id, serviceId: service.id };
}

type Catalogue = Awaited<ReturnType<typeof makeCatalogue>>;

function makeBooking(
  catalogue: Catalogue,
  customerId: string,
  options: { startsAt: Date; totalCents: number; status?: BookingStatusValue },
) {
  return testDb.booking.create({
    data: {
      reference: nextId('BMD'),
      customerId,
      ...catalogue,
      startsAt: options.startsAt,
      endsAt: new Date(options.startsAt.getTime() + 2 * HOUR),
      status: options.status ?? 'CONFIRMED',
      subtotalCents: options.totalCents,
      totalCents: options.totalCents,
    },
  });
}

function makePayment(
  customerId: string,
  options: {
    amountCents: number;
    status?: 'SUCCESSFUL' | 'PENDING' | 'FAILED';
    bookingId?: string;
    rentalId?: string;
  },
) {
  const status = options.status ?? 'SUCCESSFUL';
  return testDb.payment.create({
    data: {
      reference: nextId('PAY'),
      idempotencyKey: nextId('KEY'),
      customerId,
      provider: 'MPESA',
      purpose: options.rentalId ? 'RENTAL' : 'BOOKING',
      status,
      amountCents: options.amountCents,
      bookingId: options.bookingId ?? null,
      rentalId: options.rentalId ?? null,
      ...(status === 'SUCCESSFUL' ? { paidAt: new Date(), receiptNumber: nextId('RCP') } : {}),
    },
  });
}

describe('GET /me/dashboard', () => {
  it('requires a signed-in account', async () => {
    const res = await request(app).get(`${ME}/dashboard`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it("shows only the caller's own records and works out the balance due", async () => {
    const catalogue = await makeCatalogue();
    const alice = await registerCustomer(app, { firstName: 'Alice' });
    const bob = await registerCustomer(app, { firstName: 'Bob' });
    const aliceId = alice.session.user.id;

    const upcoming = await makeBooking(catalogue, aliceId, {
      startsAt: fromNow(3 * DAY),
      totalCents: 500_000,
    });
    await makePayment(aliceId, { bookingId: upcoming.id, amountCents: 200_000 });
    // A pending payment has not reduced what is owed.
    await makePayment(aliceId, { bookingId: upcoming.id, amountCents: 300_000, status: 'PENDING' });

    const completed = await makeBooking(catalogue, aliceId, {
      startsAt: fromNow(-10 * DAY),
      totalCents: 250_000,
      status: 'COMPLETED',
    });
    await makePayment(aliceId, { bookingId: completed.id, amountCents: 250_000 });

    // Cancelled: not billable, so it adds nothing to the balance.
    await makeBooking(catalogue, aliceId, {
      startsAt: fromNow(-5 * DAY),
      totalCents: 900_000,
      status: 'CANCELLED',
    });

    await makeBooking(catalogue, bob.session.user.id, {
      startsAt: fromNow(4 * DAY),
      totalCents: 777_000,
    });

    await testDb.notification.createMany({
      data: [
        { userId: aliceId, type: 'booking', title: 'Booking confirmed', body: 'See you soon.' },
        {
          userId: aliceId,
          type: 'payment',
          title: 'Payment received',
          body: 'Thank you.',
          readAt: new Date(),
        },
        { userId: bob.session.user.id, type: 'booking', title: 'For Bob', body: 'Private.' },
      ],
    });

    const res = await request(app).get(`${ME}/dashboard`).set(bearer(alice.accessToken));

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const dashboard = res.body.data as CustomerDashboard;

    expect(dashboard.profile).toMatchObject({ firstName: 'Alice', emailVerified: false });
    expect(dashboard.stats).toEqual({
      upcomingBookings: 1,
      activeRentals: 0,
      balanceDueCents: 300_000,
      totalPaidCents: 450_000,
      unreadNotifications: 1,
    });
    expect(dashboard.upcomingBookings).toEqual([
      expect.objectContaining({
        id: upcoming.id,
        status: 'CONFIRMED',
        totalCents: 500_000,
        paidCents: 200_000,
        studioName: 'B.M.D Studio',
        roomName: 'Podcast Studio A',
        serviceName: 'Podcast Recording',
      }),
    ]);
    expect(dashboard.recentBookings.map((booking) => booking.status)).toEqual([
      'CANCELLED',
      'COMPLETED',
    ]);
    expect(dashboard.recentPayments).toHaveLength(3);
    expect(dashboard.notifications).toHaveLength(2);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('777000');
    expect(body).not.toContain('For Bob');
  });
});

describe('customer lists', () => {
  it('splits bookings into upcoming and past, paginated', async () => {
    const catalogue = await makeCatalogue();
    const alice = await registerCustomer(app);
    const aliceId = alice.session.user.id;

    const soonest = await makeBooking(catalogue, aliceId, {
      startsAt: fromNow(1 * DAY),
      totalCents: 100_000,
    });
    await makeBooking(catalogue, aliceId, { startsAt: fromNow(2 * DAY), totalCents: 100_000 });
    const latest = await makeBooking(catalogue, aliceId, {
      startsAt: fromNow(3 * DAY),
      totalCents: 100_000,
    });
    const past = await makeBooking(catalogue, aliceId, {
      startsAt: fromNow(-2 * DAY),
      totalCents: 100_000,
      status: 'COMPLETED',
    });

    const first = await request(app)
      .get(`${ME}/bookings`)
      .query({ scope: 'upcoming', pageSize: 2 })
      .set(bearer(alice.accessToken));
    expect(first.status).toBe(200);
    expect((first.body.data as DashboardBooking[])[0]?.id).toBe(soonest.id);
    expect(first.body.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });

    const second = await request(app)
      .get(`${ME}/bookings`)
      .query({ scope: 'upcoming', pageSize: 2, page: 2 })
      .set(bearer(alice.accessToken));
    expect((second.body.data as DashboardBooking[]).map((booking) => booking.id)).toEqual([
      latest.id,
    ]);

    const history = await request(app)
      .get(`${ME}/bookings`)
      .query({ scope: 'past' })
      .set(bearer(alice.accessToken));
    expect((history.body.data as DashboardBooking[]).map((booking) => booking.id)).toEqual([
      past.id,
    ]);

    const invalid = await request(app)
      .get(`${ME}/bookings`)
      .query({ scope: 'someday' })
      .set(bearer(alice.accessToken));
    expect(invalid.status).toBe(400);
  });

  it('lists rentals with grouped items and flags a late return as overdue', async () => {
    const alice = await registerCustomer(app);
    const aliceId = alice.session.user.id;
    const category = await testDb.equipmentCategory.create({
      data: { name: 'Microphones', slug: 'microphones' },
    });
    const unit = (name: string, assetTag: string) =>
      testDb.equipment.create({
        data: { categoryId: category.id, name, assetTag, dailyRateCents: 150_000 },
      });
    const micA = await unit('Shure SM7B', 'MIC-A');
    const micB = await unit('Shure SM7B', 'MIC-B');
    const camera = await unit('Sony A7 III', 'CAM-A');

    const lateStart = fromNow(-3 * DAY);
    const lateEnd = fromNow(-1 * DAY);
    const late = await testDb.equipmentRental.create({
      data: {
        reference: nextId('HIRE'),
        customerId: aliceId,
        startsAt: lateStart,
        endsAt: lateEnd,
        status: 'CHECKED_OUT',
        subtotalCents: 600_000,
        totalCents: 600_000,
        items: {
          create: [micA, micB].map((mic) => ({
            equipmentId: mic.id,
            startsAt: lateStart,
            endsAt: lateEnd,
            unitRateCents: 150_000,
            totalCents: 300_000,
          })),
        },
      },
    });

    const returnedStart = fromNow(-20 * DAY);
    const returnedEnd = fromNow(-18 * DAY);
    const returned = await testDb.equipmentRental.create({
      data: {
        reference: nextId('HIRE'),
        customerId: aliceId,
        startsAt: returnedStart,
        endsAt: returnedEnd,
        status: 'RETURNED',
        subtotalCents: 300_000,
        totalCents: 300_000,
        items: {
          create: {
            equipmentId: camera.id,
            startsAt: returnedStart,
            endsAt: returnedEnd,
            unitRateCents: 150_000,
            totalCents: 300_000,
          },
        },
      },
    });
    await makePayment(aliceId, { rentalId: late.id, amountCents: 100_000 });

    const active = await request(app)
      .get(`${ME}/rentals`)
      .query({ scope: 'active' })
      .set(bearer(alice.accessToken));
    expect(active.status).toBe(200);
    expect(active.body.data as DashboardRental[]).toEqual([
      expect.objectContaining({
        id: late.id,
        status: 'CHECKED_OUT',
        isOverdue: true,
        paidCents: 100_000,
        items: ['Shure SM7B × 2'],
      }),
    ]);

    const history = await request(app)
      .get(`${ME}/rentals`)
      .query({ scope: 'past' })
      .set(bearer(alice.accessToken));
    expect(history.body.data as DashboardRental[]).toEqual([
      expect.objectContaining({ id: returned.id, isOverdue: false, items: ['Sony A7 III'] }),
    ]);
  });

  it('lists deliverables, linking only galleries that are published', async () => {
    const catalogue = await makeCatalogue();
    const alice = await registerCustomer(app);
    const bob = await registerCustomer(app);

    const booking = await makeBooking(catalogue, alice.session.user.id, {
      startsAt: fromNow(-3 * DAY),
      totalCents: 100_000,
      status: 'COMPLETED',
    });
    const bobBooking = await makeBooking(catalogue, bob.session.user.id, {
      startsAt: fromNow(-6 * DAY),
      totalCents: 100_000,
      status: 'COMPLETED',
    });
    const published = await testDb.gallery.create({
      data: { slug: 'alice-shoot', title: 'Alice shoot', isPublished: true },
    });
    const draft = await testDb.gallery.create({ data: { slug: 'alice-draft', title: 'Draft' } });

    await testDb.bookingDeliverable.create({
      data: {
        bookingId: booking.id,
        title: 'Edited photos',
        galleryId: published.id,
        deliveredAt: new Date(),
      },
    });
    await testDb.bookingDeliverable.create({
      data: { bookingId: booking.id, title: 'Raw files', galleryId: draft.id, dueAt: fromNow(DAY) },
    });
    await testDb.bookingDeliverable.create({
      data: { bookingId: bobBooking.id, title: 'Bob files' },
    });

    const res = await request(app).get(`${ME}/deliverables`).set(bearer(alice.accessToken));

    expect(res.status).toBe(200);
    const items = res.body.data as DashboardDeliverable[];
    expect(items).toHaveLength(2);
    expect(items.map((item) => [item.title, item.gallerySlug, item.bookingReference])).toEqual(
      expect.arrayContaining([
        ['Edited photos', 'alice-shoot', booking.reference],
        ['Raw files', null, booking.reference],
      ]),
    );
  });
});

describe('notifications', () => {
  it("lists, filters and marks notifications read — only the caller's own", async () => {
    const alice = await registerCustomer(app);
    const bob = await registerCustomer(app);
    const aliceId = alice.session.user.id;

    const unreadA = await testDb.notification.create({
      data: { userId: aliceId, type: 'booking', title: 'One', body: 'First' },
    });
    await testDb.notification.create({
      data: { userId: aliceId, type: 'booking', title: 'Two', body: 'Second' },
    });
    await testDb.notification.create({
      data: { userId: aliceId, type: 'payment', title: 'Old', body: 'Read', readAt: new Date() },
    });
    const bobs = await testDb.notification.create({
      data: { userId: bob.session.user.id, type: 'booking', title: 'Bob', body: 'Private' },
    });

    const unread = await request(app)
      .get(`${ME}/notifications`)
      .query({ filter: 'unread' })
      .set(bearer(alice.accessToken));
    expect((unread.body.data as DashboardNotification[]).map((n) => n.title).sort()).toEqual([
      'One',
      'Two',
    ]);
    expect(unread.body.meta.total).toBe(2);

    const count = () =>
      request(app).get(`${ME}/notifications/unread-count`).set(bearer(alice.accessToken));
    expect((await count()).body.data).toEqual({ count: 2 });

    const foreign = await request(app)
      .post(`${ME}/notifications/${bobs.id}/read`)
      .set(bearer(alice.accessToken));
    expect(foreign.status).toBe(404);

    const readOne = await request(app)
      .post(`${ME}/notifications/${unreadA.id}/read`)
      .set(bearer(alice.accessToken));
    expect(readOne.status).toBe(200);
    expect((await count()).body.data).toEqual({ count: 1 });

    const readAll = await request(app)
      .post(`${ME}/notifications/read-all`)
      .set(bearer(alice.accessToken));
    expect(readAll.body.data).toEqual({ updated: 1 });
    expect((await count()).body.data).toEqual({ count: 0 });

    const bobsNow = await testDb.notification.findUniqueOrThrow({ where: { id: bobs.id } });
    expect(bobsNow.readAt).toBeNull();
  });
});

describe('profile and security', () => {
  it('updates the profile and normalises the phone number', async () => {
    const alice = await registerCustomer(app);

    const res = await request(app)
      .patch(`${ME}/profile`)
      .set(bearer(alice.accessToken))
      .send({ firstName: 'Alicia', lastName: 'Wambui', phone: '0711 222 333' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      firstName: 'Alicia',
      lastName: 'Wambui',
      phone: '+254711222333',
    });
    expect(await testDb.auditLog.count({ where: { action: 'account.profile_updated' } })).toBe(1);
  });

  it('refuses a phone number that belongs to another account', async () => {
    await registerCustomer(app, { phone: '0711222333' });
    const alice = await registerCustomer(app);

    const res = await request(app)
      .patch(`${ME}/profile`)
      .set(bearer(alice.accessToken))
      .send({ firstName: 'Alice', lastName: 'Kamau', phone: '0711 222 333' });

    expect(res.status).toBe(409);
  });

  it('changes the password and signs out every other device', async () => {
    const email = 'alice@example.test';
    const alice = await registerCustomer(app, { email });
    const otherDevice = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email, password: PASSWORD });
    const otherCookie = refreshCookieFrom(otherDevice);
    const change = (body: object) =>
      request(app).post(`${ME}/password`).set(bearer(alice.accessToken)).send(body);

    const wrong = await change({ currentPassword: 'wrong-pass-123', newPassword: 'new-pass-4567' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details).toEqual([
      { path: 'currentPassword', message: 'Your current password is incorrect.' },
    ]);

    const unchanged = await change({ currentPassword: PASSWORD, newPassword: PASSWORD });
    expect(unchanged.status).toBe(400);
    expect(unchanged.body.error.details[0].path).toBe('newPassword');

    const ok = await change({ currentPassword: PASSWORD, newPassword: 'new-pass-4567' });
    expect(ok.status).toBe(200);

    // The device that made the change stays signed in; the other is signed out.
    expect(
      (await request(app).get(`${API_PREFIX}/auth/me`).set(bearer(alice.accessToken))).status,
    ).toBe(200);
    expect(
      (await request(app).post(`${API_PREFIX}/auth/refresh`).set('Cookie', otherCookie)).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get(`${API_PREFIX}/auth/me`)
          .set(bearer(otherDevice.body.data.accessToken as string))
      ).status,
    ).toBe(401);

    const oldLogin = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email, password: PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email, password: 'new-pass-4567' });
    expect(newLogin.status).toBe(200);
  });

  it('lists signed-in devices and signs one out remotely', async () => {
    const email = 'devices@example.test';
    const alice = await registerCustomer(app, { email });
    const phone = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1')
      .send({ email, password: PASSWORD });
    const phoneCookie = refreshCookieFrom(phone);

    const list = await request(app).get(`${ME}/sessions`).set(bearer(alice.accessToken));
    const devices = list.body.data as AccountSession[];
    expect(devices).toHaveLength(2);
    expect(devices[0]?.current).toBe(true);
    const phoneSession = devices.find((device) => !device.current);
    expect(phoneSession?.userAgent).toContain('iPhone');

    const self = await request(app)
      .delete(`${ME}/sessions/${devices[0]?.id ?? ''}`)
      .set(bearer(alice.accessToken));
    expect(self.status).toBe(400);

    const revoked = await request(app)
      .delete(`${ME}/sessions/${phoneSession?.id ?? ''}`)
      .set(bearer(alice.accessToken));
    expect(revoked.status).toBe(200);
    expect(
      (await request(app).post(`${API_PREFIX}/auth/refresh`).set('Cookie', phoneCookie)).status,
    ).toBe(401);

    const after = await request(app).get(`${ME}/sessions`).set(bearer(alice.accessToken));
    expect(after.body.data).toHaveLength(1);

    const bob = await registerCustomer(app);
    const bobDevices = await request(app).get(`${ME}/sessions`).set(bearer(bob.accessToken));
    const foreign = await request(app)
      .delete(`${ME}/sessions/${(bobDevices.body.data as AccountSession[])[0]?.id ?? ''}`)
      .set(bearer(alice.accessToken));
    expect(foreign.status).toBe(404);
  });
});

describe('notification preferences', () => {
  it('stores choices per channel, with marketing off until the customer opts in', async () => {
    const alice = await registerCustomer(app);
    const find = (list: NotificationPreference[], channel: string, category: string) =>
      list.find((entry) => entry.channel === channel && entry.category === category)?.enabled;

    const initial = await request(app)
      .get(`${ME}/notification-preferences`)
      .set(bearer(alice.accessToken));
    const defaults = initial.body.data as NotificationPreference[];
    expect(defaults).toHaveLength(12);
    expect(
      defaults.filter((entry) => entry.category === 'marketing').every((e) => !e.enabled),
    ).toBe(true);
    expect(defaults.filter((entry) => entry.category !== 'marketing').every((e) => e.enabled)).toBe(
      true,
    );

    const updated = await request(app)
      .put(`${ME}/notification-preferences`)
      .set(bearer(alice.accessToken))
      .send({
        preferences: [
          { channel: 'SMS', category: 'booking', enabled: false },
          { channel: 'EMAIL', category: 'marketing', enabled: true },
        ],
      });
    expect(updated.status).toBe(200);

    const reread = await request(app)
      .get(`${ME}/notification-preferences`)
      .set(bearer(alice.accessToken));
    const stored = reread.body.data as NotificationPreference[];
    expect(find(stored, 'SMS', 'booking')).toBe(false);
    expect(find(stored, 'EMAIL', 'marketing')).toBe(true);
    expect(find(stored, 'WHATSAPP', 'marketing')).toBe(false);

    const invalid = await request(app)
      .put(`${ME}/notification-preferences`)
      .set(bearer(alice.accessToken))
      .send({ preferences: [{ channel: 'PIGEON', category: 'booking', enabled: true }] });
    expect(invalid.status).toBe(400);
  });
});
