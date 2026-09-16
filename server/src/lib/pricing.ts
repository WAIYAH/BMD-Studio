import {
  CENTS_PER_UNIT,
  hourlyRateForMinutes,
  sumCents,
  type Cents,
  type PricingModelValue,
  type QuoteLine,
} from '@bmd/shared';

/**
 * Server-side pricing. Pure functions with no database access, so the
 * arithmetic can be tested exhaustively and read in one sitting.
 *
 * Every amount a customer sees is a whole number of shillings. M-Pesa settles
 * in whole shillings, so a total of KES 3,750.50 would be a total nobody could
 * actually pay.
 */

export function roundToShilling(cents: number): Cents {
  return Math.round(cents / CENTS_PER_UNIT) * CENTS_PER_UNIT;
}

export function ceilToShilling(cents: number): Cents {
  return Math.ceil(cents / CENTS_PER_UNIT) * CENTS_PER_UNIT;
}

export interface PriceBookingInput {
  pricingModel: PricingModelValue;
  serviceName: string;
  roomName: string;
  /** The room's override where one is set, otherwise the service's base price. */
  rateCents: Cents;
  durationMinutes: number;
  /** The chosen package, for services priced per package. */
  packageName?: string | null;
  packagePriceCents?: Cents | null;
  /** From `tax.vat_percent`; null when VAT is not configured. */
  vatPercent: number | null;
  /** From `booking.deposit_percent`; null means the full total is due. */
  depositPercent: number | null;
}

export interface PricedBooking {
  lines: QuoteLine[];
  subtotalCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  depositCents: Cents;
}

/**
 * What the session itself costs, before tax.
 *
 * `HOURLY` pro-rates the rate over the booked minutes; `SESSION` is a flat fee
 * however long the session runs; `PACKAGE` is the chosen package's price, which
 * is a price for the deliverables rather than for the room's time.
 */
function serviceCharge(input: PriceBookingInput): { label: string; amountCents: Cents } {
  if (input.pricingModel === 'PACKAGE' && input.packagePriceCents != null) {
    return {
      label: `${input.serviceName} — ${input.packageName ?? 'Package'}`,
      amountCents: roundToShilling(input.packagePriceCents),
    };
  }

  if (input.pricingModel === 'HOURLY') {
    return {
      label: `${input.serviceName} in ${input.roomName}`,
      amountCents: roundToShilling(hourlyRateForMinutes(input.rateCents, input.durationMinutes)),
    };
  }

  return {
    label: `${input.serviceName} in ${input.roomName}`,
    amountCents: roundToShilling(input.rateCents),
  };
}

export interface PriceHireLine {
  key: string;
  label: string;
  quantity: number;
  dailyRateCents: Cents;
  /** Per unit, refundable when the equipment comes back in good order. */
  depositCents: Cents;
}

export interface PricedHire {
  lines: Array<PriceHireLine & { totalCents: Cents; depositCents: Cents }>;
  subtotalCents: Cents;
  taxCents: Cents;
  depositCents: Cents;
  totalCents: Cents;
}

/**
 * What a hire costs: the daily rate over whole studio days, VAT on that charge,
 * and the deposits held alongside it.
 *
 * A deposit is not a sale — it is the studio holding the customer's money until
 * the equipment comes back — so VAT is charged on the hire only.
 */
export function priceHire(input: {
  lines: PriceHireLine[];
  days: number;
  vatPercent: number | null;
}): PricedHire {
  const lines = input.lines.map((line) => ({
    ...line,
    totalCents: roundToShilling(line.dailyRateCents * input.days * line.quantity),
    depositCents: roundToShilling(line.depositCents * line.quantity),
  }));

  const subtotalCents = sumCents(lines.map((line) => line.totalCents));
  const depositCents = sumCents(lines.map((line) => line.depositCents));

  const vatPercent = usablePercent(input.vatPercent);
  const taxCents = vatPercent === null ? 0 : roundToShilling((subtotalCents * vatPercent) / 100);

  return {
    lines,
    subtotalCents,
    taxCents,
    depositCents,
    totalCents: subtotalCents + taxCents + depositCents,
  };
}

/** A percentage that a settings row could plausibly mean. */
function usablePercent(percent: number | null): number | null {
  return percent != null && Number.isFinite(percent) && percent >= 0 ? percent : null;
}

export function priceBooking(input: PriceBookingInput): PricedBooking {
  const charge = serviceCharge(input);

  const lines: QuoteLine[] = [
    {
      kind: 'SERVICE',
      label: charge.label,
      quantity: 1,
      unitPriceCents: charge.amountCents,
      totalCents: charge.amountCents,
    },
  ];

  const subtotalCents = sumCents(lines.map((line) => line.totalCents));

  const vatPercent = usablePercent(input.vatPercent);
  const taxCents = vatPercent === null ? 0 : roundToShilling((subtotalCents * vatPercent) / 100);
  const totalCents = subtotalCents + taxCents;

  // An unconfigured deposit percentage means the studio has not said a deposit
  // is enough, so the whole total is due before the room is held.
  const depositPercent = usablePercent(input.depositPercent);
  const depositCents =
    depositPercent === null
      ? totalCents
      : Math.min(totalCents, ceilToShilling((totalCents * depositPercent) / 100));

  return { lines, subtotalCents, taxCents, totalCents, depositCents };
}
