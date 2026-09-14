import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatClockRange,
  formatDayHeading,
  formatMinuteOfDay,
  formatWeekdays,
  zonedDateKey,
} from './datetime';

describe('formatClock', () => {
  it('reads the wall clock of the given zone, not the device', () => {
    expect(formatClock('2026-09-14T03:00:00Z', 'Africa/Nairobi')).toBe('06:00');
    expect(formatClock('2026-09-14T03:00:00Z', 'UTC')).toBe('03:00');
  });

  it('formats a range', () => {
    expect(formatClockRange('2026-09-14T03:00:00Z', '2026-09-14T07:00:00Z', 'Africa/Nairobi')).toBe(
      '06:00 – 10:00',
    );
  });
});

describe('zonedDateKey', () => {
  it('puts a late-evening UTC instant on the next local day', () => {
    expect(zonedDateKey('2026-09-13T22:30:00Z', 'Africa/Nairobi')).toBe('2026-09-14');
    expect(zonedDateKey('2026-09-13T22:30:00Z', 'UTC')).toBe('2026-09-13');
  });
});

describe('formatDayHeading', () => {
  it('names the local day', () => {
    expect(formatDayHeading('2026-09-13T22:30:00Z', 'Africa/Nairobi')).toBe('Monday 14 September');
  });
});

describe('formatMinuteOfDay', () => {
  it.each([
    [0, '00:00'],
    [75, '01:15'],
    [360, '06:00'],
    [1440, '24:00'],
  ])('formats minute %i as %s', (minute, expected) => {
    expect(formatMinuteOfDay(minute)).toBe(expected);
  });
});

describe('formatWeekdays', () => {
  it.each([
    [[1, 2, 3, 4, 5], 'Mon – Fri'],
    [[5, 1, 3], 'Mon, Wed, Fri'],
    [[6], 'Sat'],
    [[0, 6], 'Sun, Sat'],
    [[0, 1, 2, 3, 4, 5, 6], 'Every day'],
  ])('formats %j as %s', (days, expected) => {
    expect(formatWeekdays(days)).toBe(expected);
  });
});
