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
