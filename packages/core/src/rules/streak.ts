import type { DayKey, Instant } from '../types';
import { DEFAULT_TIMEZONE, daysBetween, toDayKey } from './time';

/**
 * Riding streaks, in the rider's own timezone.
 *
 * The prototype fakes this: `streak` is a counter a button increments, and it
 * never falls. The real thing is date arithmetic, and it has to answer two
 * questions honestly — has the rider ridden today, and is the streak still
 * alive — from `users.streak`, `users.last_ride` and `users.timezone` alone
 * (plan §3 and §5).
 */

/**
 * How many days a rider may miss without losing the streak.
 *
 * **Zero is a placeholder, not a decision.** The handoff calls the grace period
 * out as an open question and the plan schedules it with the Home screen
 * (plan §5, T8). Nothing here bakes it in: every function below takes it as an
 * option, so setting a launch value is a one-line change at the call site once
 * the owner has decided.
 */
export const STREAK_GRACE_DAYS = 0;

/** When and where "today" is, for anything that has to know. */
export interface RiderClock {
  /** Defaults to now. Always passed explicitly in tests. */
  readonly now?: Instant;
  /** The rider's IANA timezone, `users.timezone`. */
  readonly timezone?: string;
  /** Overrides `STREAK_GRACE_DAYS` for this call. */
  readonly graceDays?: number;
}

/** The streak fields as they are stored on the rider. */
export interface StreakState {
  /** Days in a row, as last written. May be stale — see `currentStreak`. */
  readonly streak: number;
  /** `users.last_ride`: a day key, a stored datetime, or null for never. */
  readonly lastRide: Instant | null;
}

function resolve(clock: RiderClock): {
  today: DayKey;
  grace: number;
} {
  const timezone = clock.timezone || DEFAULT_TIMEZONE;
  return {
    today: toDayKey(clock.now ?? Date.now(), timezone),
    grace: clock.graceDays ?? STREAK_GRACE_DAYS,
  };
}

/** The rider's own calendar day, right now. */
export function riderToday(clock: RiderClock = {}): DayKey {
  return resolve(clock).today;
}

/**
 * Has the rider already logged a ride today? Drives the "I rode today" button
 * turning green, and makes a second tap a no-op.
 */
export function rodeToday(lastRide: Instant | null, clock: RiderClock = {}): boolean {
  if (lastRide == null) return false;
  const { today } = resolve(clock);
  return toDayKey(lastRide, clock.timezone || DEFAULT_TIMEZONE) === today;
}

/**
 * The streak as it actually stands now, which is not always the number in the
 * database: a stored streak of 12 whose last ride was a fortnight ago is a
 * streak of zero. Read through this rather than showing `users.streak` raw.
 */
export function currentStreak(state: StreakState, clock: RiderClock = {}): number {
  if (state.lastRide == null || state.streak <= 0) return 0;
  const { today, grace } = resolve(clock);
  const gap = daysBetween(toDayKey(state.lastRide, clock.timezone || DEFAULT_TIMEZONE), today);
  // A last ride in the future is a clock skew, not a broken streak: keep it.
  if (gap < 0) return state.streak;
  return gap <= 1 + grace ? state.streak : 0;
}

/** What a ride log did, so the caller knows whether to write and what to say. */
export interface RideResult extends StreakState {
  /** The rider's day the ride was logged on. */
  readonly lastRide: DayKey;
  /** False when the rider had already logged today — nothing to write. */
  readonly changed: boolean;
}

/**
 * Log a ride for today and work out the streak that follows.
 *
 * - Already ridden today: nothing changes.
 * - Rode yesterday (or inside the grace window): the streak goes up by one.
 * - Longer gap, or a first ever ride: the streak restarts at one.
 */
export function logRide(state: StreakState, clock: RiderClock = {}): RideResult {
  const { today, grace } = resolve(clock);
  const timezone = clock.timezone || DEFAULT_TIMEZONE;
  const last = state.lastRide == null ? null : toDayKey(state.lastRide, timezone);

  if (last === today) {
    return { streak: state.streak, lastRide: today, changed: false };
  }

  const previous = currentStreak(state, clock);
  const gap = last == null ? Number.POSITIVE_INFINITY : daysBetween(last, today);
  const continues = previous > 0 && gap >= 1 && gap <= 1 + grace;

  return { streak: continues ? previous + 1 : 1, lastRide: today, changed: true };
}

/**
 * The seven-day strip on the streak card: one filled cell per day of the
 * current streak, oldest first, capped at the strip length.
 *
 * It is derived from the streak rather than from a per-day ride history,
 * because the data model stores a streak and a last ride, not a calendar.
 */
export function streakStrip(streak: number, days = 7): boolean[] {
  const filled = Math.max(0, Math.min(days, Math.floor(streak)));
  return Array.from({ length: days }, (_, i) => i < filled);
}
