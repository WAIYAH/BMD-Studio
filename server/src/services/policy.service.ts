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

export async function getBookingPolicy(): Promise<PublicBookingPolicy> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(POLICY_SETTINGS).map((setting) => setting.key) } },
    select: { key: true, value: true },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));

  const read = ({ key, max }: { key: string; max: number }): number | null => {
    const value = values.get(key);
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
      ? value
      : null;
  };

  return {
    cancellationWindowHours: read(POLICY_SETTINGS.cancellationWindowHours),
    maxAdvanceDays: read(POLICY_SETTINGS.maxAdvanceDays),
    depositPercent: read(POLICY_SETTINGS.depositPercent),
    lateFeePercentPerDay: read(POLICY_SETTINGS.lateFeePercentPerDay),
    vatPercent: read(POLICY_SETTINGS.vatPercent),
  };
}
