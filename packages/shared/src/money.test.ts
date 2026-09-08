import { describe, expect, it } from 'vitest';
import {
  centsToShillings,
  formatKes,
  hourlyRateForMinutes,
  shillingsToCents,
  sumCents,
} from './money.js';

describe('money conversion', () => {
  it('round-trips shillings and cents', () => {
    expect(shillingsToCents(2500)).toBe(250000);
    expect(centsToShillings(250000)).toBe(2500);
  });

  it('rounds fractional shillings to the nearest cent', () => {
    expect(shillingsToCents(19.995)).toBe(2000);
  });
});

describe('hourlyRateForMinutes', () => {
  it('pro-rates part hours', () => {
    expect(hourlyRateForMinutes(250000, 60)).toBe(250000);
    expect(hourlyRateForMinutes(250000, 90)).toBe(375000);
    expect(hourlyRateForMinutes(250000, 30)).toBe(125000);
  });

  it('rounds to whole cents', () => {
    expect(hourlyRateForMinutes(100000, 7)).toBe(11667);
  });

  it('rejects negative durations', () => {
    expect(() => hourlyRateForMinutes(100000, -1)).toThrow(RangeError);
  });
});

describe('sumCents', () => {
  it('adds integer cents', () => {
    expect(sumCents([100, 250, 25])).toBe(375);
  });

  it('refuses non-integer amounts so float money cannot leak in', () => {
    expect(() => sumCents([100, 2.5])).toThrow(TypeError);
  });
});

describe('formatKes', () => {
  it('includes the currency and thousands separators', () => {
    const formatted = formatKes(250000);
    expect(formatted).toContain('2,500');
    expect(formatted).toMatch(/KES|Ksh/);
  });
});
