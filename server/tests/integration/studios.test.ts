/**
 * Public studio details. Which studios, days and rooms appear is decided by
 * flags on separate rows, so this runs against real PostgreSQL.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { API_PREFIX, type PublicStudio } from '@bmd/shared';
import { createApp } from '../../src/app.js';
import { disconnectTestDb, testDb, truncateAll } from '../helpers/db.js';

const app = createApp();

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await truncateAll();
  await disconnectTestDb();
});

describe('GET /api/v1/studios', () => {
  it('is public and returns an empty list when nothing is configured', async () => {
    const res = await request(app).get(`${API_PREFIX}/studios`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [] });
  });

  it('publishes active studios with Monday-first hours and open rooms only', async () => {
    const studio = await testDb.studio.create({
      data: {
        name: 'B.M.D Studio',
        slug: 'bmd-nairobi',
        branch: 'Nairobi',
        city: 'Nairobi',
        county: 'Nairobi',
        phone: '+254700000000',
        email: 'hello@studio.test',
        latitude: -1.2921,
        longitude: 36.8219,
      },
    });
    await testDb.studio.create({
      data: { name: 'Closed Branch', slug: 'closed-branch', isActive: false },
    });

    await testDb.operatingHour.createMany({
      data: [
        { studioId: studio.id, weekday: 0, openMinute: 0, closeMinute: 0, isClosed: true },
        { studioId: studio.id, weekday: 6, openMinute: 600, closeMinute: 960 },
        { studioId: studio.id, weekday: 1, openMinute: 480, closeMinute: 1200 },
      ],
    });

    await testDb.studioRoom.createMany({
      data: [
        {
          studioId: studio.id,
          slug: 'podcast-b',
          name: 'Podcast Studio B',
          capacity: 2,
          hourlyRateCents: 180_000,
          bufferMinutes: 10,
        },
        {
          studioId: studio.id,
          slug: 'live-room',
          name: 'Live Broadcast Room',
          description: 'On-air desk.',
          capacity: 4,
          hourlyRateCents: 350_000,
        },
        {
          studioId: studio.id,
          slug: 'photo-stage',
          name: 'Photography Stage',
          capacity: 10,
          hourlyRateCents: 500_000,
          status: 'MAINTENANCE',
        },
      ],
    });

    const res = await request(app).get(`${API_PREFIX}/studios`);

    expect(res.status).toBe(200);
    expect(res.body.data as PublicStudio[]).toEqual([
      {
        slug: 'bmd-nairobi',
        name: 'B.M.D Studio',
        branch: 'Nairobi',
        description: null,
        addressLine: null,
        city: 'Nairobi',
        county: 'Nairobi',
        phone: '+254700000000',
        email: 'hello@studio.test',
        location: { latitude: -1.2921, longitude: 36.8219 },
        timezone: 'Africa/Nairobi',
        hours: [
          { weekday: 1, isClosed: false, openMinute: 480, closeMinute: 1200 },
          { weekday: 6, isClosed: false, openMinute: 600, closeMinute: 960 },
          { weekday: 0, isClosed: true },
        ],
        rooms: [
          {
            slug: 'live-room',
            name: 'Live Broadcast Room',
            description: 'On-air desk.',
            capacity: 4,
          },
          { slug: 'podcast-b', name: 'Podcast Studio B', description: null, capacity: 2 },
        ],
      },
    ]);

    const body = JSON.stringify(res.body);
    for (const leak of [
      'hourlyRateCents',
      'bufferMinutes',
      '180000',
      'Photography Stage',
      'Closed Branch',
    ]) {
      expect(body).not.toContain(leak);
    }
  });

  it('reports no location when a coordinate is missing', async () => {
    await testDb.studio.create({
      data: { name: 'Half Mapped', slug: 'half-mapped', latitude: -1.3 },
    });

    const res = await request(app).get(`${API_PREFIX}/studios`);

    expect((res.body.data as PublicStudio[])[0]?.location).toBeNull();
  });
});
