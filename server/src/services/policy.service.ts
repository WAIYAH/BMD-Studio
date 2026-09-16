import type { PublicBookingPolicy } from '@bmd/shared';
import { prisma } from '../lib/prisma.js';

/**
 * The settings quoted by the public Booking & Hire Terms — these and no others.
 * Every other setting stays private. `max` rejects values that could only be a
 * data-entry mistake, so the terms never quote one.
 */
const POLICY_SETTINGS = {
  cancellationWindowHours: { key: 'booking.cancellation_window_hours', max: 24 * 365 },
  maxAdvanceDays: { key: 'booking.max_advance_days', max: 3650 },
  depositPercent: { key: 'booking.deposit_percent', max: 100 },
  lateFeePercentPerDay: { key: 'rental.late_fee_percent_per_day', max: 1000 },
  vatPercent: { key: 'tax.vat_percent', max: 100 },
} as const satisfies Record<keyof PublicBookingPolicy, { key: string; max: number }>;

/**
 * How long an unpaid booking holds its room. Operational rather than legal, so
 * it is not quoted in the public terms — but the booking engine cannot work
 * without a number, so an unset or nonsensical value falls back to this one.
 */
const PAYMENT_HOLD_SETTING = { key: 'booking.payment_hold_minutes', max: 24 * 60 } as const;

export const DEFAULT_PAYMENT_HOLD_MINUTES = 30;

/** The public figures plus the rules only the booking engine needs. */
export interface BookingRules extends PublicBookingPolicy {
  paymentHoldMinutes: number;
}

async function readSettings(
  keys: string[],
): Promise<(setting: { key: string; max: number }) => number | null> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return ({ key, max }) => {
    const value = values.get(key);
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
      ? value
      : null;
  };
}

export async function getBookingRules(): Promise<BookingRules> {
  const policy = await getBookingPolicy();
  const read = await readSettings([PAYMENT_HOLD_SETTING.key]);
  const hold = read(PAYMENT_HOLD_SETTING);

  return {
    ...policy,
    paymentHoldMinutes: hold && hold > 0 ? hold : DEFAULT_PAYMENT_HOLD_MINUTES,
  };
}

export async function getBookingPolicy(): Promise<PublicBookingPolicy> {
  const read = await readSettings(Object.values(POLICY_SETTINGS).map((setting) => setting.key));

  return {
    cancellationWindowHours: read(POLICY_SETTINGS.cancellationWindowHours),
    maxAdvanceDays: read(POLICY_SETTINGS.maxAdvanceDays),
    depositPercent: read(POLICY_SETTINGS.depositPercent),
    lateFeePercentPerDay: read(POLICY_SETTINGS.lateFeePercentPerDay),
    vatPercent: read(POLICY_SETTINGS.vatPercent),
  };
}
