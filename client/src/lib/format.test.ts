import { describe, expect, it } from 'vitest';
import { formatDurationRange, formatMinutes } from './format';

describe('formatMinutes', () => {
  it.each([
    [0, '0 min'],
    [30, '30 min'],
    [60, '1 hr'],
    [90, '1 hr 30 min'],
    [240, '4 hrs'],
  ])('formats %i minutes as %s', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });
});

describe('formatDurationRange', () => {
  it('joins distinct bounds', () => {
    expect(formatDurationRange(30, 180)).toBe('30 min – 3 hrs');
  });

  it('collapses equal bounds', () => {
    expect(formatDurationRange(60, 60)).toBe('1 hr');
  });
});
