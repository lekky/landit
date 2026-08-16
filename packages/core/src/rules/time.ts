import type { DayKey, Instant } from '../types';

/**
 * Day arithmetic in the rider's own timezone.
 *
 * Every date question this product asks is a *calendar day* question — did you
 * ride today, is the streak still alive, is the challenge live — and a calendar
 * day only exists inside a timezone. A rider in Auckland tapping "I rode today"
 * at 9am is on a different UTC day to the server; scoring that in UTC would
 * break their streak overnight. Hence `users.timezone`, an IANA string captured
 * at onboarding (plan §3).
 *
 * Days are handled as `YYYY-MM-DD` strings rather than `Date`s on purpose: they
 * compare and sort lexically, they survive a round trip through JSON and
 * SQLite, and they cannot silently acquire a time-of-day.
 *
 * `Intl` is part of the language, not the DOM, so this stays inside the
 * `packages/core` rule (plan §2.2).
 */

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** The timezone to fall back on when a rider has none recorded yet. */
export const DEFAULT_TIMEZONE = 'Europe/London';

/** Is this string already a `YYYY-MM-DD` day key? */
export function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && DAY_KEY_PATTERN.test(value);
}

/**
 * The calendar day an instant falls on, in the given timezone.
 *
 * A value that is already a day key is returned as-is — `users.last_ride` may
 * hold either a stored datetime or a day, and neither should be reinterpreted.
 * Throws `RangeError` on an unparseable instant or an unknown timezone, rather
 * than quietly answering with the wrong day.
 */
export function toDayKey(value: Instant, timeZone: string = DEFAULT_TIMEZONE): DayKey {
  if (isDayKey(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Not an instant: ${String(value)}`);
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dayKeyToUtcMs(day: DayKey): number {
  if (!isDayKey(day)) throw new RangeError(`Not a day key: ${String(day)}`);
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  return Date.UTC(year, month - 1, date);
}

/**
 * Whole days from `from` to `to`. Positive when `to` is later, negative when it
 * is earlier, zero on the same day.
 */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((dayKeyToUtcMs(to) - dayKeyToUtcMs(from)) / MS_PER_DAY);
}

/** The day `n` days after this one. Negative `n` goes backwards. */
export function addDays(day: DayKey, n: number): DayKey {
  const shifted = new Date(dayKeyToUtcMs(day) + n * MS_PER_DAY);
  return shifted.toISOString().slice(0, 10);
}

/** `-1`, `0` or `1`, so day keys can be sorted without knowing their shape. */
export function compareDayKeys(a: DayKey, b: DayKey): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

/** Is `day` within `[from, to]`, both ends inclusive? */
export function isDayWithin(day: DayKey, from: DayKey, to: DayKey): boolean {
  return day >= from && day <= to;
}

/**
 * The day a week turns over on, as a `Date.getUTCDay()` index: `1`, Monday.
 *
 * **One product, one definition of "a week."** The weekly challenges were
 * already Monday-to-Sunday before the weekly streak existed — every seeded
 * challenge `starts` on a Monday and `ends` on the Sunday six days later, and
 * the cards say "Opens Monday". The weekly streak (plan §1) is scored on the
 * same boundary rather than a second one, so a rider's challenge week and
 * streak week are always the same seven days.
 *
 * This is not a knob. Changing it would silently re-cut every challenge window,
 * so a different week boundary is a plan decision, not a call-site option.
 */
export const WEEK_STARTS_ON = 1;

/** The Monday of the week `day` falls in. `day` itself when it is a Monday. */
export function weekStart(day: DayKey): DayKey {
  const weekday = new Date(dayKeyToUtcMs(day)).getUTCDay();
  return addDays(day, -((weekday - WEEK_STARTS_ON + 7) % 7));
}

/** The Sunday of the week `day` falls in — inclusive, like a challenge's `ends`. */
export function weekEnd(day: DayKey): DayKey {
  return addDays(weekStart(day), 6);
}

/**
 * Whole weeks from the week containing `from` to the week containing `to`.
 * Zero when both days share a week, positive when `to` is later.
 */
export function weeksBetween(from: DayKey, to: DayKey): number {
  return daysBetween(weekStart(from), weekStart(to)) / 7;
}

/* ------------------------------------------------------- naming the day -- */

/**
 * Weekday and month names, as data.
 *
 * Deliberately **not** `toLocaleDateString`. Home's eyebrow ("Saturday 15
 * August") renders on the server and again in the browser, and anything
 * locale-derived on both sides is a hydration risk: Node and Chromium ship
 * different ICU builds, React finds the two trees disagree, and it throws away
 * the client tree — which in T6's sign-up form meant wiping what a child had
 * typed (LESSONS §3a). A date is exactly the kind of string that trap is made
 * of. Two arrays cost nothing and cannot disagree with themselves.
 *
 * English only, and that is the product: Land It has no localisation and the
 * decision to add one is not this file's to make.
 */
export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** The weekday a day key falls on: "Saturday". */
export function weekdayName(day: DayKey): string {
  return WEEKDAY_NAMES[new Date(dayKeyToUtcMs(day)).getUTCDay()] as string;
}

/** The month a day key falls in: "August". */
export function monthName(day: DayKey): string {
  return MONTH_NAMES[Number(day.slice(5, 7)) - 1] as string;
}

/**
 * "Saturday 15 August" — the greeting panel's eyebrow, in the form the design
 * pack uses (`en-GB`: day before month, no comma, no year).
 */
export function formatDayLong(day: DayKey): string {
  return `${weekdayName(day)} ${Number(day.slice(8, 10))} ${monthName(day)}`;
}
