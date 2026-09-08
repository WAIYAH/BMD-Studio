import { describe, expect, it } from 'vitest';
import {
  formatKenyanPhone,
  isValidKenyanPhone,
  normalizeKenyanPhone,
  toMpesaMsisdn,
} from './phone.js';

describe('normalizeKenyanPhone', () => {
  it('accepts the shapes customers actually type', () => {
    const expected = '+254722000000';
    for (const input of [
      '0722000000',
      '722000000',
      '254722000000',
      '+254722000000',
      '+254 722 000 000',
      '0722-000-000',
      '(0722) 000.000',
    ]) {
      expect(normalizeKenyanPhone(input), input).toBe(expected);
    }
  });

  it('accepts the 01x Safaricom/Airtel range', () => {
    expect(normalizeKenyanPhone('0110000000')).toBe('+254110000000');
  });

  it('rejects invalid numbers', () => {
    for (const input of [
      '',
      '0812000000', // invalid prefix
      '072200000', // too short
      '07220000000', // too long
      '+1 415 555 0100', // not Kenyan
      'not-a-number',
      '+254abc000000',
    ]) {
      expect(normalizeKenyanPhone(input), input).toBeNull();
    }
  });
});

describe('isValidKenyanPhone', () => {
  it('mirrors normalisation', () => {
    expect(isValidKenyanPhone('0722000000')).toBe(true);
    expect(isValidKenyanPhone('0812000000')).toBe(false);
  });
});

describe('toMpesaMsisdn', () => {
  it('drops the plus for Daraja', () => {
    expect(toMpesaMsisdn('0722000000')).toBe('254722000000');
  });

  it('returns null for invalid input rather than a malformed msisdn', () => {
    expect(toMpesaMsisdn('123')).toBeNull();
  });
});

describe('formatKenyanPhone', () => {
  it('formats for display', () => {
    expect(formatKenyanPhone('+254722000000')).toBe('0722 000 000');
  });

  it('passes through unrecognised input unchanged', () => {
    expect(formatKenyanPhone('unknown')).toBe('unknown');
  });
});
