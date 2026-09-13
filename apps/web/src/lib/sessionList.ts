import { SPORT_IDS, type SessionFilter, type SportId } from '@landit/core';

/**
 * The Sessions tab's view logic (T37) — the few decisions the list makes that
 * are not already a rule in `@landit/core`.
 *
 * Core owns what a session *is* and how a list of them is filtered, grouped and
 * summed (`filterSessions`, `groupSessionsByMonth`, `sessionMonthSummary`,
 * `topSpots`). What is left here is presentation that still has a right and a
 * wrong answer: which filter chips a rider is offered, which page numbers fit
 * in a pager, which months start open, how tall a duration bar is. Here rather
 * than in the component because this app's unit tests may only reach `src/lib`
 * (`vitest.config.ts`).
 */

/** A filter chip: everything, one sport, or "At an event". */
export type SessionListFilterId = 'all' | 'event' | SportId;

/** The core filter a chip stands for. */
export function sessionFilterFor(id: SessionListFilterId): SessionFilter {
  if (id === 'all') return {};
  if (id === 'event') return { atEvent: true };
  return { sport: id };
}

/**
 * The sports a rider gets a chip for, in the product's sport order.
 *
 * The sports on their profile plus any sport they have a session in — a rider
 * who dropped BMX from their profile still has BMX sessions worth finding. A
 * single sport gets **no** chips at all: "Scooter" beside "All" would be two
 * buttons that do the same thing.
 */
export function sessionFilterSports(
  riderSports: readonly string[],
  sessionSports: readonly string[],
): SportId[] {
  const have = new Set<string>([...riderSports, ...sessionSports]);
  const sports = SPORT_IDS.filter((id) => have.has(id));
  return sports.length > 1 ? sports : [];
}

/** "10 sessions", "1 session", "No sessions". */
export function sessionCountLabel(count: number): string {
  const n = Math.max(0, Math.trunc(count || 0));
  if (n === 0) return 'No sessions';
  return `${n} session${n === 1 ? '' : 's'}`;
}

/** "2 tricks", "1 trick". Empty for none, so a caller can drop the segment. */
export function trickCountLabel(count: number): string {
  const n = Math.max(0, Math.trunc(count || 0));
  if (n === 0) return '';
  return `${n} trick${n === 1 ? '' : 's'}`;
}

/** How many pages a list of `total` fills, never fewer than one. */
export function pageCount(total: number, perPage: number): number {
  if (!(perPage > 0)) return 1;
  return Math.max(1, Math.ceil(Math.max(0, total) / perPage));
}

/** A 1-based page, held inside the list — a delete can take the last page away. */
export function clampPage(page: number, totalPages: number): number {
  const last = Math.max(1, Math.trunc(totalPages || 1));
  const n = Math.trunc(page || 1);
  return Math.min(Math.max(1, n), last);
}

/**
 * "Showing 1–3 of 10" — the feed's footer. `page` is 1-based and is clamped,
 * so the label can never name a range past the end of the list.
 */
export function pageRangeLabel(page: number, perPage: number, total: number): string {
  const count = Math.max(0, Math.trunc(total || 0));
  if (count === 0) return 'Showing none';
  const at = clampPage(page, pageCount(count, perPage));
  const first = (at - 1) * perPage + 1;
  const last = Math.min(at * perPage, count);
  return `Showing ${first}–${last} of ${count}`;
}

/**
 * The page numbers the pager draws: at most `size`, a window that keeps the
 * current page in it and slides rather than jumping. The design draws four;
 * a rider with forty pages of sessions gets five numbers, not forty buttons
 * wrapping off a phone.
 */
export function pageWindow(page: number, totalPages: number, size = 5): number[] {
  const total = Math.max(1, Math.trunc(totalPages || 1));
  const width = Math.max(1, Math.min(Math.trunc(size), total));
  const at = clampPage(page, total);
  let start = at - Math.floor(width / 2);
  start = Math.max(1, Math.min(start, total - width + 1));
  return Array.from({ length: width }, (_, i) => start + i);
}

/** `YYYY-MM` for the month before. */
export function previousMonthKey(monthKey: string): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return '';
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return `${String(prevYear).padStart(4, '0')}-${String(prevMonth).padStart(2, '0')}`;
}

/**
 * The phone accordions that start open: this month and last month (design 2b:
 * September and August open, July closed). Every other month starts shut, and
 * each one then opens and closes on its own.
 */
export function defaultOpenMonths(currentMonthKey: string): string[] {
  const previous = previousMonthKey(currentMonthKey);
  return previous ? [currentMonthKey, previous] : [currentMonthKey];
}

/**
 * A month header's bar for one session, in px: 11px an hour, as the design
 * scales it (2h is 22px, "3h+" is 33px), and never shorter than 6px so a
 * half-hour still reads as a bar rather than a border.
 */
export function sparkHeight(durationMinutes: number): number {
  const hours = Math.max(0, durationMinutes || 0) / 60;
  return Math.max(6, Math.round(hours * 11));
}

/**
 * "Where you ride": a bar's width in px for a spot's share of the busiest
 * spot's count (core's `TopSpot.share`, 0–1). The busiest is 64px, as drawn;
 * the floor keeps a single session visible beside a spot with twenty.
 */
export function topSpotBarWidth(share: number, max = 64): number {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0));
  return Math.max(14, Math.round(clamped * max));
}
