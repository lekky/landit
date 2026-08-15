import { describe, expect, it } from 'vitest';

import {
  STREAK_GRACE_DAYS,
  currentStreak,
  logRide,
  riderToday,
  rodeToday,
  streakStrip,
} from './streak';

/**
 * The prototype's streak is a counter a button increments and nothing ever
 * decrements. These tests describe the real thing: day arithmetic in the
 * rider's timezone, which can break a streak as well as extend it.
 */

const NOON_UTC = Date.parse('2026-08-16T12:00:00Z');
const london = { now: NOON_UTC, timezone: 'Europe/London' };

describe('the rider’s today', () => {
  it('is their calendar day, not the server’s', () => {
    const evening = Date.parse('2026-08-16T13:00:00Z');
    expect(riderToday({ now: evening, timezone: 'Pacific/Auckland' })).toBe('2026-08-17');
    expect(riderToday({ now: evening, timezone: 'America/Los_Angeles' })).toBe('2026-08-16');
  });
});

describe('"rode today"', () => {
  it('is false when the rider has never logged a ride', () => {
    expect(rodeToday(null, london)).toBe(false);
  });

  it('is true for a ride logged on the rider’s current day', () => {
    expect(rodeToday('2026-08-16', london)).toBe(true);
    expect(rodeToday('2026-08-15', london)).toBe(false);
  });

  it('answers differently in two timezones for the same instant', () => {
    const clock = { now: Date.parse('2026-08-16T13:00:00Z') };
    // The rider's stored ride is on the 17th. In Auckland that is today.
    expect(rodeToday('2026-08-17', { ...clock, timezone: 'Pacific/Auckland' })).toBe(true);
    expect(rodeToday('2026-08-17', { ...clock, timezone: 'America/Los_Angeles' })).toBe(false);
  });

  it('accepts a stored datetime, not only a day', () => {
    expect(rodeToday('2026-08-16T09:15:00Z', london)).toBe(true);
  });
});

describe('the streak as it actually stands', () => {
  it('is zero for a rider who has never ridden', () => {
    expect(currentStreak({ streak: 0, lastRide: null }, london)).toBe(0);
    expect(currentStreak({ streak: 5, lastRide: null }, london)).toBe(0);
  });

  it('holds while the rider rode today or yesterday', () => {
    expect(currentStreak({ streak: 12, lastRide: '2026-08-16' }, london)).toBe(12);
    expect(currentStreak({ streak: 12, lastRide: '2026-08-15' }, london)).toBe(12);
  });

  it('falls to zero once a day is missed', () => {
    // This is the behaviour the prototype does not have: a stored 12 whose last
    // ride was a fortnight ago is not a streak of 12.
    expect(currentStreak({ streak: 12, lastRide: '2026-08-14' }, london)).toBe(0);
    expect(currentStreak({ streak: 12, lastRide: '2026-08-02' }, london)).toBe(0);
  });

  it('survives the missed day when a grace period is allowed', () => {
    const graceful = { ...london, graceDays: 1 };
    expect(currentStreak({ streak: 12, lastRide: '2026-08-14' }, graceful)).toBe(12);
    expect(currentStreak({ streak: 12, lastRide: '2026-08-13' }, graceful)).toBe(0);
  });

  it('defaults to no grace, which is a placeholder and not yet a decision', () => {
    expect(STREAK_GRACE_DAYS).toBe(0);
    expect(currentStreak({ streak: 4, lastRide: '2026-08-14' }, london)).toBe(0);
  });

  it('keeps the streak when a clock skew puts the last ride in the future', () => {
    expect(currentStreak({ streak: 4, lastRide: '2026-08-20' }, london)).toBe(4);
  });
});

describe('logging a ride', () => {
  it('starts a streak at one for a first ever ride', () => {
    expect(logRide({ streak: 0, lastRide: null }, london)).toEqual({
      streak: 1,
      lastRide: '2026-08-16',
      changed: true,
    });
  });

  it('does nothing at all on a second tap the same day', () => {
    const result = logRide({ streak: 3, lastRide: '2026-08-16' }, london);
    expect(result.changed).toBe(false);
    expect(result.streak).toBe(3);
    expect(result.lastRide).toBe('2026-08-16');
  });

  it('extends the streak by one when yesterday counted', () => {
    expect(logRide({ streak: 4, lastRide: '2026-08-15' }, london)).toEqual({
      streak: 5,
      lastRide: '2026-08-16',
      changed: true,
    });
  });

  it('restarts at one after a missed day', () => {
    expect(logRide({ streak: 9, lastRide: '2026-08-13' }, london)).toEqual({
      streak: 1,
      lastRide: '2026-08-16',
      changed: true,
    });
  });

  it('extends across a missed day when a grace period is allowed', () => {
    expect(logRide({ streak: 4, lastRide: '2026-08-14' }, { ...london, graceDays: 1 })).toEqual({
      streak: 5,
      lastRide: '2026-08-16',
      changed: true,
    });
  });

  it('records the ride against the rider’s day, not the server’s', () => {
    const clock = { now: Date.parse('2026-08-16T13:00:00Z') };
    expect(
      logRide({ streak: 0, lastRide: null }, { ...clock, timezone: 'Pacific/Auckland' }).lastRide,
    ).toBe('2026-08-17');
    expect(
      logRide({ streak: 0, lastRide: null }, { ...clock, timezone: 'America/Los_Angeles' })
        .lastRide,
    ).toBe('2026-08-16');
  });

  it('builds a run of consecutive days one at a time', () => {
    let state: { streak: number; lastRide: string | null } = { streak: 0, lastRide: null };
    for (const day of ['2026-08-10', '2026-08-11', '2026-08-12']) {
      state = logRide(state, { now: `${day}T09:00:00Z`, timezone: 'Europe/London' });
    }
    expect(state).toEqual({ streak: 3, lastRide: '2026-08-12', changed: true });
  });
});

describe('the seven-day strip', () => {
  it('fills one cell per day of the streak, oldest first', () => {
    expect(streakStrip(0)).toEqual([false, false, false, false, false, false, false]);
    expect(streakStrip(3)).toEqual([true, true, true, false, false, false, false]);
    expect(streakStrip(7)).toEqual([true, true, true, true, true, true, true]);
  });

  it('caps at the strip length rather than overflowing it', () => {
    expect(streakStrip(31)).toHaveLength(7);
    expect(streakStrip(31).every(Boolean)).toBe(true);
  });

  it('copes with a nonsense streak', () => {
    expect(streakStrip(-4).some(Boolean)).toBe(false);
  });
});
