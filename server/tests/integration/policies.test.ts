/**
 * Figures quoted by the public Booking & Hire Terms. Settings are free-form
 * JSON, so what is published — and what is withheld — is proven against the
 * real table.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { API_PREFIX } from '@bmd/shared';
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

describe('GET /api/v1/policies/booking', () => {
  it('is public and reports every figure as unset when nothing is configured', async () => {
    const res = await request(app).get(`${API_PREFIX}/policies/booking`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      cancellationWindowHours: null,
      maxAdvanceDays: null,
      depositPercent: null,
      lateFeePercentPerDay: null,
      vatPercent: null,
    });
  });

  it('publishes the booking figures and no other setting', async () => {
    await testDb.setting.createMany({
      data: [
        { key: 'booking.cancellation_window_hours', value: 24 },
        { key: 'booking.max_advance_days', value: 90 },
        { key: 'booking.deposit_percent', value: 50 },
        { key: 'rental.late_fee_percent_per_day', value: 25 },
        { key: 'tax.vat_percent', value: 16 },
        { key: 'integrations.api_token', value: 'SECRET-TOKEN' },
      ],
    });

    const res = await request(app).get(`${API_PREFIX}/policies/booking`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      cancellationWindowHours: 24,
      maxAdvanceDays: 90,
      depositPercent: 50,
      lateFeePercentPerDay: 25,
      vatPercent: 16,
    });
    expect(JSON.stringify(res.body)).not.toContain('SECRET');
  });

  it('treats malformed or out-of-range values as unset rather than quoting them', async () => {
    await testDb.setting.createMany({
      data: [
        { key: 'booking.cancellation_window_hours', value: '24' },
        { key: 'booking.max_advance_days', value: { days: 90 } },
        { key: 'booking.deposit_percent', value: 150 },
        { key: 'rental.late_fee_percent_per_day', value: 12.5 },
        { key: 'tax.vat_percent', value: -5 },
      ],
    });

    const res = await request(app).get(`${API_PREFIX}/policies/booking`);

    expect(res.body.data).toEqual({
      cancellationWindowHours: null,
      maxAdvanceDays: null,
      depositPercent: null,
      lateFeePercentPerDay: 12.5,
      vatPercent: null,
    });
  });
});
