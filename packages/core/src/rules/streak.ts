import type { DayKey, Instant } from '../types';
import { DEFAULT_TIMEZONE, daysBetween, toDayKey, weekStart, weeksBetween } from './time';

/**
 * Riding streaks, in the rider's own timezone.
 *
 * The prototype fakes this: `streak` is a counter a button increments, and it
 * never falls. The real thing is date arithmetic, and it has to answer two
 * questions honestly — has the rider ridden today, and is the streak still
 * alive — from the rider's stored streak fields and `users.timezone` alone
 * (plan §3 and §5).
 *
 * **Two regimes live in this file.**
 *
 * - The **weekly** streak, from `WEEKLY_RIDE_TARGET` down, is the product. The
 *   owner decided on 2026-08-16 (plan §1) that a streak counts consecutive
 *   *weeks* in which a rider rode at least N times, because the audience is
 *   children who realistically ride at weekends and a daily streak punishes a
 *   school week. This is what T8 wires to the Home screen.
 * - The **daily** streak — `currentStreak`, `logRide`, `streakStrip`,
 *   `STREAK_GRACE_DAYS` — predates that decision and is **superseded**. It is
 *   kept because `packages/core` is additive-only once merged, not because
 *   anything should call it. Each superseded export names its replacement.
 *
 * `rodeToday` and `riderToday` belong to neither regime and are used by both.
 */

/**
 * How many days a rider may miss without losing the *daily* streak.
 *
 * **Superseded** by `WEEKLY_STREAK_GRACE_WEEKS` — the weekly target replaced
 * the daily count and its grace period on 2026-08-16 (plan §1). Kept only
 * because merged exports in this package are never removed.
 *
 * @deprecated Weekly streak: use `WEEKLY_STREAK_GRACE_WEEKS`.
 */
export const STREAK_GRACE_DAYS = 0;

/** When and where "today" is, for anything that has to know. */
export interface RiderClock {
  /** Defaults to now. Always passed explicitly in tests. */
  readonly now?: Instant;
  /** The rider's IANA timezone, `users.timezone`. */
  readonly timezone?: string;
  /**
   * Overrides `STREAK_GRACE_DAYS` for this call.
   *
   * @deprecated Daily streak only. Weekly streak: `WeeklyStreakOptions.graceWeeks`.
   */
  readonly graceDays?: number;
}

/**
 * The daily streak fields as they are stored on the rider.
 *
 * **Superseded** by `WeeklyStreakState` (plan §1, 2026-08-16).
 *
 * @deprecated Weekly streak: use `WeeklyStreakState`.
 */
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
 * The daily streak as it actually stands now, which is not always the number in
 * the database: a stored streak of 12 whose last ride was a fortnight ago is a
 * streak of zero.
 *
 * **Superseded** by `currentWeeklyStreak` (plan §1, 2026-08-16). T8 wires the
 * weekly one; nothing new should read this.
 *
 * @deprecated Weekly streak: use `currentWeeklyStreak`.
 */
export function currentStreak(state: StreakState, clock: RiderClock = {}): number {
  if (state.lastRide == null || state.streak <= 0) return 0;
  const { today, grace } = resolve(clock);
  const gap = daysBetween(toDayKey(state.lastRide, clock.timezone || DEFAULT_TIMEZONE), today);
  // A last ride in the future is a clock skew, not a broken streak: keep it.
  if (gap < 0) return state.streak;
  return gap <= 1 + grace ? state.streak : 0;
}

/**
 * What a daily ride log did, so the caller knows whether to write.
 *
 * **Superseded** by `WeeklyRideResult` (plan §1, 2026-08-16).
 *
 * @deprecated Weekly streak: use `WeeklyRideResult`.
 */
export interface RideResult extends StreakState {
  /** The rider's day the ride was logged on. */
  readonly lastRide: DayKey;
  /** False when the rider had already logged today — nothing to write. */
  readonly changed: boolean;
}

/**
 * Log a ride for today and work out the daily streak that follows.
 *
 * - Already ridden today: nothing changes.
 * - Rode yesterday (or inside the grace window): the streak goes up by one.
 * - Longer gap, or a first ever ride: the streak restarts at one.
 *
 * **Superseded** by `logWeeklyRide` (plan §1, 2026-08-16).
 *
 * @deprecated Weekly streak: use `logWeeklyRide`.
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
 *
 * **Superseded** (plan §1, 2026-08-16): a weekly streak counts weeks, so
 * filling day cells from it would draw one cell per *week* and read as a lie.
 * `weeklyProgress` is the honest replacement — what the Home card renders from
 * it is T8's call with the design.
 *
 * @deprecated Weekly streak: use `weeklyProgress`.
 */
export function streakStrip(streak: number, days = 7): boolean[] {
  const filled = Math.max(0, Math.min(days, Math.floor(streak)));
  return Array.from({ length: days }, (_, i) => i < filled);
}

/* -------------------------------------------------------------------------- */
/* The weekly streak — the live regime (plan §1, decided 2026-08-16).          */
/* -------------------------------------------------------------------------- */

/**
 * Rides needed inside one week to keep the streak alive.
 *
 * **A tunable default, not a deliberated number.** Two is reachable on a
 * weekend alone, which is the whole point of the weekly shape; three would
 * force a school-night ride and put back the pressure the weekly target exists
 * to remove. Every function below takes `target` as an option, so moving it is
 * a one-line change here and a line in plan §1.
 */
export const WEEKLY_RIDE_TARGET = 2;

/**
 * Whole weeks a rider may miss the target without losing the streak.
 *
 * **A tunable default, and deliberately zero.** The weekly target is itself the
 * forgiveness — a rider already has seven days to find two rides — so stacking
 * a grace week on top would make the streak nearly unbreakable and turn it back
 * into the prototype's counter that never falls. Kept as an option because it
 * is the first dial to reach for if the streak proves too brittle in testing.
 */
export const WEEKLY_STREAK_GRACE_WEEKS = 0;

/** The clock, plus the two weekly dials. */
export interface WeeklyStreakOptions extends RiderClock {
  /** Rides needed in a week. Defaults to `WEEKLY_RIDE_TARGET`. */
  readonly target?: number;
  /** Weeks that may be missed. Defaults to `WEEKLY_STREAK_GRACE_WEEKS`. */
  readonly graceWeeks?: number;
}

/**
 * The weekly streak fields as they are stored on the rider.
 *
 * Four facts, because a weekly target cannot be reconstructed from a streak and
 * a last ride alone: the count has to know how far into *this* week the rider
 * is, and which week last qualified. As with the daily version no calendar is
 * stored — one counter and two day keys.
 */
export interface WeeklyStreakState {
  /** Qualifying weeks in a row, as last written. May be stale — see `currentWeeklyStreak`. */
  readonly streak: number;
  /** The Monday of the most recent week that met the target, or null for never. */
  readonly lastQualifyingWeek: DayKey | null;
  /** The Monday of the week `ridesThisWeek` counts, or null before the first ride. */
  readonly weekStart: DayKey | null;
  /** Rides logged in that week. Reset when the week rolls over, never carried across. */
  readonly ridesThisWeek: number;
  /** The last "I rode today" tap, so a second tap the same day is a no-op. */
  readonly lastRide: Instant | null;
}

function resolveWeekly(options: WeeklyStreakOptions): {
  today: DayKey;
  thisWeek: DayKey;
  target: number;
  graceWeeks: number;
} {
  const today = riderToday(options);
  return {
    today,
    thisWeek: weekStart(today),
    target: Math.max(1, Math.floor(options.target ?? WEEKLY_RIDE_TARGET)),
    graceWeeks: options.graceWeeks ?? WEEKLY_STREAK_GRACE_WEEKS,
  };
}

/**
 * The Monday that opens the rider's current week, in their own timezone.
 *
 * The timezone matters as much here as it does for "today": the same instant is
 * Sunday night in London and Monday morning in Auckland, which is the end of
 * one week and the start of the next.
 */
export function riderWeekStart(clock: RiderClock = {}): DayKey {
  return weekStart(riderToday(clock));
}

/** Has a week's ride count reached the target? */
export function weeklyTargetMet(rides: number, options: WeeklyStreakOptions = {}): boolean {
  return rides >= resolveWeekly(options).target;
}

/** Rides logged in the rider's *current* week — zero once the week has rolled over. */
export function weeklyRideCount(
  state: WeeklyStreakState,
  options: WeeklyStreakOptions = {},
): number {
  const { thisWeek } = resolveWeekly(options);
  if (state.weekStart == null || state.weekStart !== thisWeek) return 0;
  return Math.max(0, state.ridesThisWeek);
}

/** Where a rider is against this week's target — the Home card's numbers. */
export interface WeeklyProgress {
  readonly rides: number;
  readonly target: number;
  /** 0–100, capped. */
  readonly pct: number;
  readonly met: boolean;
  /** Rides still needed this week. Zero once the target is met. */
  readonly remaining: number;
}

/**
 * This week's progress, framed as what has been done rather than what is about
 * to be lost — plan §6.4, Standard 13: no loss-framed copy anywhere near this.
 */
export function weeklyProgress(
  state: WeeklyStreakState,
  options: WeeklyStreakOptions = {},
): WeeklyProgress {
  const { target } = resolveWeekly(options);
  const rides = weeklyRideCount(state, options);
  const capped = Math.min(rides, target);
  return {
    rides,
    target,
    pct: Math.round((capped / target) * 100),
    met: rides >= target,
    remaining: Math.max(0, target - rides),
  };
}

/**
 * The weekly streak as it actually stands now.
 *
 * A stored streak whose last qualifying week is old is a streak of zero — the
 * counter in the database is only ever as fresh as the last write, and nothing
 * writes to a rider who has stopped riding.
 *
 * The current week is never counted as missed: a rider two days into a week
 * still has five days to hit the target, so the streak holds until the week
 * they last qualified in is more than `graceWeeks` weeks behind.
 */
export function currentWeeklyStreak(
  state: WeeklyStreakState,
  options: WeeklyStreakOptions = {},
): number {
  if (state.lastQualifyingWeek == null || state.streak <= 0) return 0;
  const { thisWeek, graceWeeks } = resolveWeekly(options);
  const gap = weeksBetween(state.lastQualifyingWeek, thisWeek);
  // A qualifying week in the future is a clock skew, not a broken streak.
  if (gap < 0) return state.streak;
  return gap <= 1 + graceWeeks ? state.streak : 0;
}

/** What a weekly ride log did, so the caller knows whether to write and what to say. */
export interface WeeklyRideResult extends WeeklyStreakState {
  readonly weekStart: DayKey;
  readonly lastRide: DayKey;
  /** False when the rider had already logged today — nothing to write. */
  readonly changed: boolean;
  /** True only on the ride that took this week over the target. */
  readonly targetMetNow: boolean;
}

/**
 * Log a ride for today and work out the weekly streak that follows.
 *
 * - Already ridden today: nothing changes. "I rode today" is one tap a day.
 * - A new week: the ride count restarts at one.
 * - The ride that reaches the target: the week qualifies, and the streak either
 *   extends (the previous week qualified too, or is inside the grace window) or
 *   restarts at one.
 * - Rides beyond the target in a week already banked: counted, but the streak
 *   does not move. A rider cannot ride their way to a bigger number by riding
 *   more often in the same week.
 *
 * Nothing about where the rider rode is recorded — "I rode today" is a plain
 * button with no spot and no location attached (plan §1, and §6.4 Standard 10:
 * we store a spot's location, never a rider's).
 */
export function logWeeklyRide(
  state: WeeklyStreakState,
  options: WeeklyStreakOptions = {},
): WeeklyRideResult {
  const { today, thisWeek, target } = resolveWeekly(options);

  if (rodeToday(state.lastRide, options)) {
    return {
      streak: state.streak,
      lastQualifyingWeek: state.lastQualifyingWeek,
      weekStart: state.weekStart ?? thisWeek,
      ridesThisWeek: weeklyRideCount(state, options),
      lastRide: today,
      changed: false,
      targetMetNow: false,
    };
  }

  const before = weeklyRideCount(state, options);
  const rides = before + 1;
  const alreadyBanked = state.lastQualifyingWeek === thisWeek;
  const targetMetNow = !alreadyBanked && before < target && rides >= target;

  if (!targetMetNow) {
    return {
      streak: state.streak,
      lastQualifyingWeek: state.lastQualifyingWeek,
      weekStart: thisWeek,
      ridesThisWeek: rides,
      lastRide: today,
      changed: true,
      targetMetNow: false,
    };
  }

  // This week has just qualified. It extends the run if the week it follows
  // qualified too — which `currentWeeklyStreak` has already decided for us.
  const previous = currentWeeklyStreak(state, options);
  return {
    streak: previous + 1,
    lastQualifyingWeek: thisWeek,
    weekStart: thisWeek,
    ridesThisWeek: rides,
    lastRide: today,
    changed: true,
    targetMetNow: true,
  };
}

/* -------------------------------------------------------------------------- */
/* What the streak card says (T8, 2026-08-16).                                 */
/* -------------------------------------------------------------------------- */

/**
 * The words on the Home streak card live here, not in the screen, for the same
 * reason `stickerCondition` and `challengeRangeLabel` do: they are decisions
 * rather than decoration, and a decision in a `.tsx` file has no test around it.
 *
 * Two decisions in particular, both one careless copy edit from reverting:
 *
 * - **The unit is weeks.** The streak counted days until 2026-08-16 (plan §1).
 *   Every sentence below says "week", and `weeklyStreakLabel` is the only place
 *   the noun is written down.
 * - **Nothing is loss-framed.** Plan §6.4, Standard 13: "a rider is shown the
 *   rides they have made this week, never the streak they are about to lose."
 *   So there is no "don't break it", no "your streak ends in", no countdown —
 *   and `streak-copy` is tested against a list of the words that would put one
 *   back.
 */

/** "5 weeks", "1 week", "No weeks yet". The card's Anton headline. */
export function weeklyStreakLabel(weeks: number): string {
  const n = Math.max(0, Math.floor(weeks));
  if (n === 0) return 'No weeks yet';
  return `${n} week${n === 1 ? '' : 's'}`;
}

/** "1 of 2 rides this week" — what the strip under the headline is counting. */
export function weeklyProgressLabel(progress: WeeklyProgress): string {
  const shown = Math.min(progress.rides, progress.target);
  return `${shown} of ${progress.target} ride${progress.target === 1 ? '' : 's'} this week`;
}

/**
 * The line under the strip. Gain-framed in every branch — it names what a ride
 * *earns*, never what missing one costs.
 */
export function weeklyEncouragement(progress: WeeklyProgress): string {
  if (progress.met) {
    const spare = progress.rides - progress.target;
    return spare > 0
      ? `This week is banked, with ${spare} ride${spare === 1 ? '' : 's'} to spare.`
      : 'This week is banked.';
  }
  if (progress.remaining === 1) return 'One more ride banks this week.';
  return `${progress.remaining} rides bank this week.`;
}
