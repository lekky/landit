import { DEFAULT_TIMEZONE } from './time';
import type { RiderClock } from './streak';

/**
 * When Land It may and may not reach out to a rider.
 *
 * Plan §6.4, Standard 13 — the Children's code standard on nudge techniques —
 * names three things this product does not build: loss-framed notifications
 * ("your streak dies in 2 hours"), a paid streak freeze, and **any notification
 * between 21:00 and 07:00 in the rider's own time**. The first two are absences;
 * this one is a rule, and a rule with nobody to enforce it is a sentence in a
 * document.
 *
 * So it is a function, here, before anything can send anything. Land It has no
 * push notifications and no scheduled email beyond the guardian-consent flow at
 * the time of writing — which is exactly why the guard is cheap now and
 * expensive the day someone adds a reminder job and reasons about the window in
 * their head.
 *
 * **The window is the rider's, not the server's.** Nine at night is a different
 * instant in Auckland and Los Angeles, and a job that runs on the box's clock
 * would be sending to a child in bed. Same argument as `time.ts` makes for the
 * calendar day, and the same `users.timezone` answers it.
 *
 * Quiet hours are also **not** a knob a caller may widen. Every function takes
 * the clock and the timezone; none takes the hours.
 */

/** Nothing is sent from this hour (inclusive), rider-local. */
export const NUDGE_QUIET_FROM_HOUR = 21;

/** Sending resumes at this hour, rider-local. */
export const NUDGE_QUIET_UNTIL_HOUR = 7;

/**
 * The rider's own hour of the day, 0–23.
 *
 * `Intl` is part of the language rather than the DOM, so this stays inside the
 * `packages/core` rule (plan §2.2). `hourCycle: 'h23'` rather than `hour12:
 * false`, because the latter still yields "24" at midnight in some runtimes.
 */
export function riderHour(clock: RiderClock = {}): number {
  const timeZone = clock.timezone || DEFAULT_TIMEZONE;
  const at = clock.now ?? Date.now();
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Not an instant: ${String(clock.now)}`);
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
}

/**
 * Is it the quiet part of the rider's night? The window wraps midnight, so this
 * is an "or", not a "between".
 */
export function isQuietHours(clock: RiderClock = {}): boolean {
  const hour = riderHour(clock);
  return hour >= NUDGE_QUIET_FROM_HOUR || hour < NUDGE_QUIET_UNTIL_HOUR;
}

/**
 * May Land It send this rider something right now?
 *
 * The one call site anything with a send button should have. It fails **closed**
 * on a timezone it cannot resolve — an unknown zone throws from `riderHour`
 * rather than defaulting to "yes, send it".
 */
export function canNudge(clock: RiderClock = {}): boolean {
  return !isQuietHours(clock);
}
