import { describe, expect, it } from 'vitest';

import { CHALLENGES } from '../data/challenges';
import {
  DEFAULT_TIMEZONE,
  WEEK_STARTS_ON,
  addDays,
  compareDayKeys,
  daysBetween,
  isDayKey,
  isDayWithin,
  toDayKey,
  weekEnd,
  weekStart,
  weeksBetween,
} from './time';

describe('day keys', () => {
  it('recognises a YYYY-MM-DD day and nothing else', () => {
    expect(isDayKey('2026-08-16')).toBe(true);
    expect(isDayKey('2026-8-16')).toBe(false);
    expect(isDayKey('2026-08-16T10:00:00Z')).toBe(false);
    expect(isDayKey(20260816)).toBe(false);
  });

  it('returns a day key unchanged rather than reinterpreting it', () => {
    // `users.last_ride` may already hold a day. Re-zoning it would shift it.
    expect(toDayKey('2026-08-16', 'Pacific/Auckland')).toBe('2026-08-16');
    expect(toDayKey('2026-08-16', 'America/Los_Angeles')).toBe('2026-08-16');
  });
});

describe('an instant becomes a different day in a different timezone', () => {
  // 13:00 UTC is already tomorrow in Auckland and still today in Los Angeles.
  const instant = Date.parse('2026-08-16T13:00:00Z');

  it('reads the rider’s calendar day, not the server’s', () => {
    expect(toDayKey(instant, 'Pacific/Auckland')).toBe('2026-08-17');
    expect(toDayKey(instant, 'America/Los_Angeles')).toBe('2026-08-16');
    expect(toDayKey(instant, 'UTC')).toBe('2026-08-16');
  });

  it('accepts a Date, an epoch and an ISO string alike', () => {
    expect(toDayKey(new Date(instant), 'UTC')).toBe('2026-08-16');
    expect(toDayKey(instant, 'UTC')).toBe('2026-08-16');
    expect(toDayKey('2026-08-16T13:00:00Z', 'UTC')).toBe('2026-08-16');
  });

  it('handles a timezone whose offset is not a whole hour', () => {
    // Kathmandu is UTC+5:45, which is exactly the case naive maths gets wrong.
    expect(toDayKey(Date.parse('2026-08-16T18:20:00Z'), 'Asia/Kathmandu')).toBe('2026-08-17');
    expect(toDayKey(Date.parse('2026-08-16T18:10:00Z'), 'Asia/Kathmandu')).toBe('2026-08-16');
  });

  it('defaults to the launch market rather than to UTC', () => {
    expect(DEFAULT_TIMEZONE).toBe('Europe/London');
    // British Summer Time: 23:30 UTC on the 16th is already the 17th in London.
    expect(toDayKey(Date.parse('2026-08-16T23:30:00Z'))).toBe('2026-08-17');
  });

  it('refuses to guess at nonsense rather than answering wrongly', () => {
    expect(() => toDayKey('not a date', 'UTC')).toThrow(RangeError);
    expect(() => toDayKey(Date.now(), 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('day arithmetic', () => {
  it('counts whole days forwards and backwards', () => {
    expect(daysBetween('2026-08-16', '2026-08-17')).toBe(1);
    expect(daysBetween('2026-08-16', '2026-08-16')).toBe(0);
    expect(daysBetween('2026-08-17', '2026-08-16')).toBe(-1);
  });

  it('crosses months, years and leap days', () => {
    expect(daysBetween('2026-07-31', '2026-08-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2); // 2028 is a leap year
  });

  it('is not thrown by a daylight-saving change', () => {
    // The clocks go forward in the UK on 2027-03-28. A day is still a day.
    expect(daysBetween('2027-03-27', '2027-03-29')).toBe(2);
  });

  it('shifts a day forwards and backwards', () => {
    expect(addDays('2026-08-16', 1)).toBe('2026-08-17');
    expect(addDays('2026-08-16', -1)).toBe('2026-08-15');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-08-16', 0)).toBe('2026-08-16');
  });

  it('sorts and ranges without needing to know the format', () => {
    expect(compareDayKeys('2026-08-16', '2026-08-17')).toBe(-1);
    expect(compareDayKeys('2026-08-17', '2026-08-16')).toBe(1);
    expect(compareDayKeys('2026-08-16', '2026-08-16')).toBe(0);

    expect(isDayWithin('2026-08-16', '2026-08-10', '2026-08-16')).toBe(true); // end inclusive
    expect(isDayWithin('2026-08-10', '2026-08-10', '2026-08-16')).toBe(true); // start inclusive
    expect(isDayWithin('2026-08-17', '2026-08-10', '2026-08-16')).toBe(false);
  });
});

describe('weeks, cut where the challenges cut them', () => {
  it('opens the week on Monday and closes it on Sunday', () => {
    // 2026-08-10 is a Monday, 2026-08-16 the Sunday that closes the same week.
    expect(weekStart('2026-08-10')).toBe('2026-08-10');
    expect(weekStart('2026-08-13')).toBe('2026-08-10');
    expect(weekStart('2026-08-16')).toBe('2026-08-10');
    expect(weekEnd('2026-08-10')).toBe('2026-08-16');
    expect(weekEnd('2026-08-16')).toBe('2026-08-16');
    expect(weekStart('2026-08-17')).toBe('2026-08-17'); // the next week opens
  });

  it('agrees with every seeded challenge window', () => {
    // One product, one definition of a week: the streak week must be the same
    // seven days as the challenge week, or "this week" means two things.
    expect(WEEK_STARTS_ON).toBe(1);
    for (const challenge of CHALLENGES) {
      expect(weekStart(challenge.starts)).toBe(challenge.starts);
      expect(weekEnd(challenge.starts)).toBe(challenge.ends);
    }
  });

  it('crosses a month and a year boundary', () => {
    expect(weekStart('2026-08-01')).toBe('2026-07-27');
    expect(weekEnd('2026-12-31')).toBe('2027-01-03');
  });

  it('counts whole weeks between the weeks two days fall in', () => {
    expect(weeksBetween('2026-08-10', '2026-08-16')).toBe(0); // same week
    expect(weeksBetween('2026-08-16', '2026-08-17')).toBe(1); // Sunday to Monday
    expect(weeksBetween('2026-08-10', '2026-08-31')).toBe(3);
    expect(weeksBetween('2026-08-31', '2026-08-10')).toBe(-3);
  });
});
