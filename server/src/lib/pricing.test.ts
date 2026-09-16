import { describe, expect, it } from 'vitest';
import { ceilToShilling, priceBooking, roundToShilling } from './pricing.js';

/** KES shorthand: the seed and the studio both think in whole shillings. */
const KES = (shillings: number): number => shillings * 100;

const BASE = {
  serviceName: 'Podcast Recording',
  roomName: 'Podcast Studio A',
  rateCents: KES(2500),
  durationMinutes: 60,
  vatPercent: 16,
  depositPercent: 50,
} as const;

describe('rounding', () => {
  it('rounds to whole shillings, because M-Pesa cannot settle cents', () => {
    expect(roundToShilling(1249)).toBe(1200);
    expect(roundToShilling(1250)).toBe(1300);
    expect(ceilToShilling(1201)).toBe(1300);
    expect(ceilToShilling(1200)).toBe(1200);
  });
});

describe('priceBooking', () => {
  it('pro-rates an hourly service over the booked minutes', () => {
    const priced = priceBooking({ ...BASE, pricingModel: 'HOURLY', durationMinutes: 90 });

    expect(priced.subtotalCents).toBe(KES(3750));
    expect(priced.taxCents).toBe(KES(600));
    expect(priced.totalCents).toBe(KES(4350));
    expect(priced.lines).toEqual([
      {
        kind: 'SERVICE',
        label: 'Podcast Recording in Podcast Studio A',
        quantity: 1,
        unitPriceCents: KES(3750),
        totalCents: KES(3750),
      },
    ]);
  });

  it('charges a session service its flat rate however long it runs', () => {
    const short = priceBooking({ ...BASE, pricingModel: 'SESSION', durationMinutes: 120 });
    const long = priceBooking({ ...BASE, pricingModel: 'SESSION', durationMinutes: 480 });

    expect(short.subtotalCents).toBe(KES(2500));
    expect(long.subtotalCents).toBe(short.subtotalCents);
  });

  it('charges the chosen package, not the room rate', () => {
    const priced = priceBooking({
      ...BASE,
      pricingModel: 'PACKAGE',
      packageName: 'Portrait — Extended',
      packagePriceCents: KES(22000),
    });

    expect(priced.subtotalCents).toBe(KES(22000));
    expect(priced.lines[0]?.label).toBe('Podcast Recording — Portrait — Extended');
  });

  it('keeps every amount a whole number of shillings', () => {
    // 45 minutes of KES 1,801/hr is 1,350.75 — not a payable amount.
    const priced = priceBooking({
      ...BASE,
      pricingModel: 'HOURLY',
      rateCents: KES(1801),
      durationMinutes: 45,
      vatPercent: 16,
    });

    for (const amount of [
      priced.subtotalCents,
      priced.taxCents,
      priced.totalCents,
      priced.depositCents,
    ]) {
      expect(amount % 100).toBe(0);
    }
  });

  it('adds no tax when VAT is not configured', () => {
    const priced = priceBooking({ ...BASE, pricingModel: 'HOURLY', vatPercent: null });

    expect(priced.taxCents).toBe(0);
    expect(priced.totalCents).toBe(priced.subtotalCents);
  });

  it('rounds a deposit up, and never above the total', () => {
    const half = priceBooking({ ...BASE, pricingModel: 'HOURLY', depositPercent: 50 });
    expect(half.depositCents).toBe(half.totalCents / 2);

    const everything = priceBooking({ ...BASE, pricingModel: 'HOURLY', depositPercent: 150 });
    expect(everything.depositCents).toBe(everything.totalCents);
  });

  it('asks for the full total when no deposit percentage is configured', () => {
    const priced = priceBooking({ ...BASE, pricingModel: 'HOURLY', depositPercent: null });

    expect(priced.depositCents).toBe(priced.totalCents);
  });

  it('asks for nothing up front when the deposit is zero', () => {
    const priced = priceBooking({ ...BASE, pricingModel: 'HOURLY', depositPercent: 0 });

    expect(priced.depositCents).toBe(0);
  });
});
