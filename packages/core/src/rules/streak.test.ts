import { describe, expect, it } from 'vitest';

import {
  STREAK_GRACE_DAYS,
  WEEKLY_RIDE_TARGET,
  WEEKLY_STREAK_GRACE_WEEKS,
  currentStreak,
  currentWeeklyStreak,
  logRide,
  logWeeklyRide,
  riderToday,
  riderWeekStart,
  rodeToday,
  streakStrip,
  weeklyProgress,
  weeklyRideCount,
  weeklyTargetMet,
  type WeeklyStreakState,
} from './streak';

/**
 * The prototype's streak is a counter a button increments and nothing ever
 * decrements. These tests describe the real thing: date arithmetic in the
 * rider's timezone, which can break a streak as well as extend it.
 *
 * The daily-streak blocks below cover the **superseded** regime (plan §1,
 * 2026-08-16). They stay green because those exports still stand — the weekly
 * blocks at the bottom of the file are the ones describing the product.
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

  it('defaults to no grace — a placeholder the weekly target has since retired', () => {
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

/**
 * The weekly streak — the live regime (plan §1, decided 2026-08-16). A streak
 * counts consecutive *weeks* in which the rider rode at least twice, on the
 * Monday-to-Sunday week the challenges already use.
 */

// 2026-08-16 is the Sunday closing the week that opened Monday 2026-08-10.
const THIS_WEEK = '2026-08-10';
const LAST_WEEK = '2026-08-03';
const TWO_WEEKS_AGO = '2026-07-27';

const fresh: WeeklyStreakState = {
  streak: 0,
  lastQualifyingWeek: null,
  weekStart: null,
  ridesThisWeek: 0,
  lastRide: null,
};

describe('the weekly dials', () => {
  it('default to two rides a week and no grace week', () => {
    // Both are tunable defaults rather than deliberated numbers (plan §1), and
    // every function below takes them as options.
    expect(WEEKLY_RIDE_TARGET).toBe(2);
    expect(WEEKLY_STREAK_GRACE_WEEKS).toBe(0);
  });

  it('open the rider’s week on their own Monday', () => {
    expect(riderWeekStart(london)).toBe(THIS_WEEK);
  });
});

describe('meeting the week’s target', () => {
  it('needs the target reached, not merely approached', () => {
    expect(weeklyTargetMet(0, london)).toBe(false);
    expect(weeklyTargetMet(1, london)).toBe(false);
    expect(weeklyTargetMet(2, london)).toBe(true);
    expect(weeklyTargetMet(9, london)).toBe(true);
  });

  it('takes a different target when one is passed', () => {
    expect(weeklyTargetMet(2, { ...london, target: 3 })).toBe(false);
    expect(weeklyTargetMet(3, { ...london, target: 3 })).toBe(true);
  });

  it('counts only rides inside the rider’s current week', () => {
    const state = { ...fresh, weekStart: THIS_WEEK, ridesThisWeek: 2 };
    expect(weeklyRideCount(state, london)).toBe(2);
    // The same stored count, a week later, is not this week's count.
    expect(weeklyRideCount({ ...state, weekStart: LAST_WEEK }, london)).toBe(0);
  });

  it('reports progress as what has been done, never as what is about to be lost', () => {
    expect(weeklyProgress({ ...fresh, weekStart: THIS_WEEK, ridesThisWeek: 1 }, london)).toEqual({
      rides: 1,
      target: 2,
      pct: 50,
      met: false,
      remaining: 1,
    });
    expect(weeklyProgress({ ...fresh, weekStart: THIS_WEEK, ridesThisWeek: 3 }, london)).toEqual({
      rides: 3,
      target: 2,
      pct: 100,
      met: true,
      remaining: 0,
    });
    expect(weeklyProgress(fresh, london).pct).toBe(0);
  });
});

describe('the weekly streak as it actually stands', () => {
  it('is zero for a rider who has never met a week', () => {
    expect(currentWeeklyStreak(fresh, london)).toBe(0);
    expect(currentWeeklyStreak({ ...fresh, streak: 5 }, london)).toBe(0);
  });

  it('holds while this week or last week qualified', () => {
    // This week already banked: the streak stands.
    expect(
      currentWeeklyStreak({ ...fresh, streak: 6, lastQualifyingWeek: THIS_WEEK }, london),
    ).toBe(6);
    // Last week banked and this week still running: it stands too, because the
    // rider has not missed anything yet.
    expect(
      currentWeeklyStreak({ ...fresh, streak: 6, lastQualifyingWeek: LAST_WEEK }, london),
    ).toBe(6);
  });

  it('falls to zero as soon as a whole week is missed', () => {
    expect(
      currentWeeklyStreak({ ...fresh, streak: 6, lastQualifyingWeek: TWO_WEEKS_AGO }, london),
    ).toBe(0);
  });

  it('reads a stale stored streak as zero rather than showing it raw', () => {
    // A stored 12 whose last qualifying week was in the spring is not a 12.
    expect(
      currentWeeklyStreak({ ...fresh, streak: 12, lastQualifyingWeek: '2026-04-06' }, london),
    ).toBe(0);
  });

  it('survives the missed week when a grace week is allowed', () => {
    const graceful = { ...london, graceWeeks: 1 };
    const state = { ...fresh, streak: 6, lastQualifyingWeek: TWO_WEEKS_AGO };
    expect(currentWeeklyStreak(state, graceful)).toBe(6);
    expect(currentWeeklyStreak({ ...state, lastQualifyingWeek: '2026-07-20' }, graceful)).toBe(0);
  });

  it('keeps the streak when a clock skew puts the qualifying week in the future', () => {
    expect(
      currentWeeklyStreak({ ...fresh, streak: 4, lastQualifyingWeek: '2026-08-24' }, london),
    ).toBe(4);
  });
});

describe('logging a weekly ride', () => {
  it('counts the first ride without yet banking the week', () => {
    expect(logWeeklyRide(fresh, london)).toEqual({
      streak: 0,
      lastQualifyingWeek: null,
      weekStart: THIS_WEEK,
      ridesThisWeek: 1,
      lastRide: '2026-08-16',
      changed: true,
      targetMetNow: false,
    });
  });

  it('does nothing at all on a second tap the same day', () => {
    const state = { ...fresh, weekStart: THIS_WEEK, ridesThisWeek: 1, lastRide: '2026-08-16' };
    const result = logWeeklyRide(state, london);
    expect(result.changed).toBe(false);
    expect(result.ridesThisWeek).toBe(1);
    expect(result.streak).toBe(0);
  });

  it('starts a streak at one on the ride that meets the target', () => {
    const state = { ...fresh, weekStart: THIS_WEEK, ridesThisWeek: 1, lastRide: '2026-08-15' };
    expect(logWeeklyRide(state, london)).toEqual({
      streak: 1,
      lastQualifyingWeek: THIS_WEEK,
      weekStart: THIS_WEEK,
      ridesThisWeek: 2,
      lastRide: '2026-08-16',
      changed: true,
      targetMetNow: true,
    });
  });

  it('extends the streak when the week before qualified too', () => {
    const state: WeeklyStreakState = {
      streak: 3,
      lastQualifyingWeek: LAST_WEEK,
      weekStart: THIS_WEEK,
      ridesThisWeek: 1,
      lastRide: '2026-08-15',
    };
    const result = logWeeklyRide(state, london);
    expect(result.streak).toBe(4);
    expect(result.targetMetNow).toBe(true);
  });

  it('restarts at one when a week was missed in between', () => {
    const state: WeeklyStreakState = {
      streak: 9,
      lastQualifyingWeek: TWO_WEEKS_AGO,
      weekStart: THIS_WEEK,
      ridesThisWeek: 1,
      lastRide: '2026-08-15',
    };
    const result = logWeeklyRide(state, london);
    expect(result.streak).toBe(1);
    expect(result.lastQualifyingWeek).toBe(THIS_WEEK);
  });

  it('does not move the streak again for extra rides in a week already banked', () => {
    // Riding four times in one week is a streak of one week, not of four.
    const state: WeeklyStreakState = {
      streak: 2,
      lastQualifyingWeek: THIS_WEEK,
      weekStart: THIS_WEEK,
      ridesThisWeek: 2,
      lastRide: '2026-08-15',
    };
    const result = logWeeklyRide(state, london);
    expect(result.streak).toBe(2);
    expect(result.ridesThisWeek).toBe(3);
    expect(result.targetMetNow).toBe(false);
  });

  it('restarts the ride count when the week rolls over', () => {
    const state: WeeklyStreakState = {
      streak: 1,
      lastQualifyingWeek: LAST_WEEK,
      weekStart: LAST_WEEK,
      ridesThisWeek: 4,
      lastRide: '2026-08-09',
    };
    const result = logWeeklyRide(state, london);
    expect(result.weekStart).toBe(THIS_WEEK);
    expect(result.ridesThisWeek).toBe(1);
    expect(result.streak).toBe(1); // this week is not banked yet
  });

  it('builds a run of weeks two rides at a time', () => {
    let state: WeeklyStreakState = fresh;
    // Two rides each weekend, three weekends running — a school week in
    // between costs the rider nothing, which is the whole point.
    for (const day of [
      '2026-07-25',
      '2026-07-26',
      '2026-08-01',
      '2026-08-02',
      '2026-08-08',
      '2026-08-09',
    ]) {
      state = logWeeklyRide(state, { now: `${day}T09:00:00Z`, timezone: 'Europe/London' });
    }
    expect(state.streak).toBe(3);
    expect(state.lastQualifyingWeek).toBe('2026-08-03');
  });

  it('loses the run when a whole weekend is skipped', () => {
    let state: WeeklyStreakState = fresh;
    for (const day of ['2026-07-25', '2026-07-26', '2026-08-08', '2026-08-09']) {
      state = logWeeklyRide(state, { now: `${day}T09:00:00Z`, timezone: 'Europe/London' });
    }
    expect(state.streak).toBe(1);
  });
});

describe('the week boundary is the rider’s, not the server’s', () => {
  // Sunday 23:30 in London is already Monday 10:30 in Auckland: one instant,
  // two different weeks, and a ride that counts towards two different targets.
  const instant = Date.parse('2026-08-16T22:30:00Z');

  it('puts the same instant in different weeks in different timezones', () => {
    expect(riderWeekStart({ now: instant, timezone: 'Europe/London' })).toBe('2026-08-10');
    expect(riderWeekStart({ now: instant, timezone: 'Pacific/Auckland' })).toBe('2026-08-17');
    expect(riderWeekStart({ now: instant, timezone: 'America/Los_Angeles' })).toBe('2026-08-10');
  });

  it('banks the ride against the rider’s own week', () => {
    const state = { ...fresh, weekStart: '2026-08-10', ridesThisWeek: 1, lastRide: '2026-08-15' };

    const uk = logWeeklyRide(state, { now: instant, timezone: 'Europe/London' });
    expect(uk.weekStart).toBe('2026-08-10');
    expect(uk.ridesThisWeek).toBe(2);
    expect(uk.targetMetNow).toBe(true);

    // In Auckland it is already a new week, so the same ride is that week's first.
    const nz = logWeeklyRide(state, { now: instant, timezone: 'Pacific/Auckland' });
    expect(nz.weekStart).toBe('2026-08-17');
    expect(nz.ridesThisWeek).toBe(1);
    expect(nz.targetMetNow).toBe(false);
  });

  it('breaks a streak in one timezone that still stands in another', () => {
    const state = { ...fresh, streak: 5, lastQualifyingWeek: '2026-08-03' };
    // London is still in the week after the qualifying one: the streak holds.
    expect(currentWeeklyStreak(state, { now: instant, timezone: 'Europe/London' })).toBe(5);
    // Auckland has turned over into the week after that: it is gone.
    expect(currentWeeklyStreak(state, { now: instant, timezone: 'Pacific/Auckland' })).toBe(0);
  });
});
