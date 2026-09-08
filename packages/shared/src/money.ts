import { CENTS_PER_UNIT, CURRENCY } from './constants.js';

/**
 * Money is always an integer count of KES cents. Never use floats for money:
 * `0.1 + 0.2 !== 0.3` is not an acceptable property for an invoice.
 */
export type Cents = number;

export function shillingsToCents(shillings: number): Cents {
  return Math.round(shillings * CENTS_PER_UNIT);
}

export function centsToShillings(cents: Cents): number {
  return cents / CENTS_PER_UNIT;
}

/** Formats cents as `KES 12,500.00`. */
export function formatKes(cents: Cents, options: { withDecimals?: boolean } = {}): string {
  const { withDecimals = true } = options;
  const formatter = new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  });
  return formatter.format(centsToShillings(cents));
}

/**
 * Pro-rates an hourly rate over a duration, rounding to the nearest cent.
 * Used by the pricing service; kept here so client-side estimates and the
 * authoritative server-side calculation cannot drift apart.
 */
export function hourlyRateForMinutes(hourlyRateCents: Cents, minutes: number): Cents {
  if (minutes < 0) throw new RangeError('minutes must not be negative');
  return Math.round((hourlyRateCents * minutes) / 60);
}

/** Sums line totals, guarding against accidental float contamination. */
export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce<Cents>((total, value) => {
    if (!Number.isInteger(value)) {
      throw new TypeError(`Monetary values must be integer cents, received ${value}`);
    }
    return total + value;
  }, 0);
}
