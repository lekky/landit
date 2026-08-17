import { MONTH_LABELS, toDayKey, type Instant } from '@landit/core';

/**
 * Dates as the design writes them, without touching ICU.
 *
 * `toLocaleDateString` is the obvious way to do this and it is the wrong one
 * here: anything locale-derived renders differently under Node and under
 * Chromium often enough to matter, and a date rendered on both sides of a
 * hydration boundary is a mismatch that throws the tree away rather than
 * warning about it (LESSONS §3a). The day comes from `toDayKey`, which is
 * timezone-aware and already the product's definition of a day, and the month
 * name comes from a table.
 */

/** "1 Jun 2026". The `.lab` class is what uppercases it on screen. */
export function shortDate(instant: Instant, timezone?: string): string {
  const key = toDayKey(instant, timezone);
  const day = Number(key.slice(8, 10));
  const month = MONTH_LABELS[Number(key.slice(5, 7)) - 1] ?? '';
  return `${day} ${month} ${key.slice(0, 4)}`;
}

/** "Mar 2026" — a joining date, where the day is noise. Same no-ICU rule. */
export function monthYear(instant: Instant, timezone?: string): string {
  const key = toDayKey(instant, timezone);
  const month = MONTH_LABELS[Number(key.slice(5, 7)) - 1] ?? '';
  return `${month} ${key.slice(0, 4)}`;
}

/**
 * "16 Aug, 23:53" — an audit row's timestamp, where the minute is the point.
 *
 * **Entirely UTC**, date and clock together, and the caller labels it so. The
 * audit log is the server's record of when a change landed; rendering it in a
 * reader's zone would give two staff members in two countries different answers
 * about the same row.
 *
 * The first version of this took the date from `toDayKey` and the time from
 * `getUTC*`, which is two zones in one string: at 00:53 in London on 17 August
 * it rendered "17 Aug, 23:53" — the London date beside the UTC clock, an hour
 * and a day apart, and entirely plausible-looking. It was caught by reading a
 * row on screen against the row in the database. Hence the UTC getters
 * throughout, and no `timezone` parameter at all: there is no zone to pass.
 */
export function shortDateTime(instant: Instant): string {
  const at = new Date(instant);
  if (Number.isNaN(at.getTime())) return '';
  const month = MONTH_LABELS[at.getUTCMonth()] ?? '';
  const hh = String(at.getUTCHours()).padStart(2, '0');
  const mm = String(at.getUTCMinutes()).padStart(2, '0');
  return `${at.getUTCDate()} ${month}, ${hh}:${mm}`;
}

/**
 * "20 min ago", "Yesterday", "1 Jun 2026" — the crew feed's timestamps.
 *
 * Same rule as `shortDate` and the same reason: no `Intl.RelativeTimeFormat`,
 * no `toLocaleString`, nothing that two runtimes can spell differently. Plain
 * arithmetic on two instants, and a table of words.
 *
 * It is computed on the server and handed to the client as a finished string,
 * so it never re-renders into a different answer under the reader's clock.
 * The cost is that a feed left open goes stale, which is the right trade for a
 * page that is not a live feed by design (plan §6.1).
 */
export function relativeTime(instant: Instant, now: Instant, timezone?: string): string {
  const then = new Date(instant).getTime();
  const at = new Date(now).getTime();
  const minutes = Math.floor((at - then) / 60000);

  if (!Number.isFinite(minutes) || minutes < 0) return 'Just now';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;

  const thenKey = toDayKey(instant, timezone);
  const todayKey = toDayKey(now, timezone);
  const days = Math.round((Date.parse(todayKey) - Date.parse(thenKey)) / 86400000);
  if (days <= 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return shortDate(instant, timezone);
}
