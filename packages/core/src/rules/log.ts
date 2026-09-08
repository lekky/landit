import { STAGE } from '../data/stages';
import { TRICKS } from '../data/tricks';
import type { DayKey, Instant, SportId, StageId, Trick, TrickLogEntry } from '../types';
import { DEFAULT_TIMEZONE, daysBetween, monthName, toDayKey } from './time';
import { isLandedStage, trickById } from './tricks';

/**
 * Everything derived from `trick_log`.
 *
 * The log is append-only — the app never edits a row — but a rider may delete
 * their own rows when they tracked something by mistake. So every date in the
 * product is *recomputed* from whatever rows remain rather than cached
 * anywhere (plan §3).
 */

/** Options shared by the date-shaped readings of the log. */
export interface LogOptions {
  /** Narrow to one sport. Omit for everything. */
  readonly sport?: SportId | null;
  /** The rider's IANA timezone; months are their months. */
  readonly timezone?: string;
  /** Overrides the trick library, for hooks reading live rows. */
  readonly tricks?: readonly Trick[];
}

/** Oldest first. Ties keep their original order, so a stable sort matters. */
function chronological(log: readonly TrickLogEntry[]): TrickLogEntry[] {
  return [...log].sort((a, b) => a.at - b.at);
}

/**
 * When each trick *first* counted as landed, keyed by trick id.
 *
 * Only the first landing counts: moving from `some` to `every` later does not
 * reset the date, and dropping back to `trying` does not erase it — the rider
 * did land it. Deleting the log rows does, which is the point.
 */
export function firstLanded(log: readonly TrickLogEntry[]): Record<string, TrickLogEntry> {
  const out: Record<string, TrickLogEntry> = {};
  for (const entry of chronological(log)) {
    if (isLandedStage(entry.stage) && !out[entry.trick]) out[entry.trick] = entry;
  }
  return out;
}

/** One month's worth of landings, for the over-time chart. */
export interface LandedMonth {
  /** `YYYY-MM`, in the rider's timezone. */
  readonly key: string;
  /**
   * Short month name, e.g. "Aug".
   *
   * @deprecated Locale-derived (ICU), so it can differ between Node and the
   * browser and is a hydration mismatch waiting to happen (LESSONS §3a). Render
   * `monthKeyLabel(key)` from `./progress` instead, which reads the month out of
   * `key` with no locale involved (issue #56).
   */
  readonly label: string;
  /** Tricks first landed in this month. */
  readonly n: number;
  /**
   * How many of those `n` came from estimated dates. The chart says so rather
   * than pretending a backfilled date is exact.
   */
  readonly est: number;
}

function monthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Tricks landed per month over the last `months` months, oldest first, with
 * every month present even when it is empty.
 *
 * Months are the rider's months: the boundary between July and August is
 * midnight where they are, not midnight UTC.
 */
export function landedByMonth(
  log: readonly TrickLogEntry[],
  now: Instant = Date.now(),
  months = 6,
  options: LogOptions = {},
): LandedMonth[] {
  const timezone = options.timezone || DEFAULT_TIMEZONE;
  const tricks = options.tricks ?? TRICKS;
  const today = toDayKey(now, timezone);
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7)) - 1;

  const buckets = new Map<string, { key: string; label: string; n: number; est: number }>();
  const order: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(thisYear, thisMonth - i, 1));
    const year = dt.getUTCFullYear();
    const monthIndex = dt.getUTCMonth();
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    buckets.set(key, { key, label: monthLabel(year, monthIndex), n: 0, est: 0 });
    order.push(key);
  }

  for (const entry of Object.values(firstLanded(log))) {
    const trick = trickById(entry.trick, tricks);
    if (!trick) continue;
    if (options.sport && trick.sport !== options.sport) continue;
    const bucket = buckets.get(toDayKey(entry.at, timezone).slice(0, 7));
    if (!bucket) continue;
    bucket.n += 1;
    if (entry.estimated) bucket.est += 1;
  }

  return order.map((key) => buckets.get(key)!);
}

/**
 * The most recent first-landings, newest first — the "latest lands" list on the
 * progress screen.
 */
export function latestLanded(
  log: readonly TrickLogEntry[],
  limit = 5,
  options: LogOptions = {},
): TrickLogEntry[] {
  const tricks = options.tricks ?? TRICKS;
  return Object.values(firstLanded(log))
    .filter((entry) => {
      const trick = trickById(entry.trick, tricks);
      return !!trick && (!options.sport || trick.sport === options.sport);
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

/**
 * The log rows to delete when a rider clears a trick's stage. The prototype
 * drops the trick's entries outright, and so does this: the undo path has to
 * leave no trace, or the "first landed" date reappears the moment they track it
 * again.
 */
export function logEntriesForTrick(
  log: readonly TrickLogEntry[],
  trickId: string,
): TrickLogEntry[] {
  return log.filter((entry) => entry.trick === trickId);
}

/* -------------------------------------------------- the trick page (T31) -- */

/** One row of a rider's history with a trick, ready to draw. */
export interface TrickHistoryEntry {
  readonly stage: StageId;
  /** Epoch milliseconds. */
  readonly at: number;
  /** Backfilled rather than observed; the row says "(estimated)". */
  readonly estimated: boolean;
  /** The first entry that counted as landed — at most one row carries this. */
  readonly firstLanded: boolean;
  /** "3 Aug 2026", in the rider's timezone. */
  readonly dateLabel: string;
}

export interface TrickHistory {
  /** Oldest first. Empty when nothing has been logged for the trick. */
  readonly entries: readonly TrickHistoryEntry[];
  /**
   * One line over the timeline: "Learning to landed in 2 weeks",
   * "Learning since 5 Aug · 4 weeks", or "Nothing logged yet".
   */
  readonly summary: string;
}

export interface TrickHistoryOptions {
  /** The rider's IANA timezone; days and weeks are theirs. */
  readonly timezone?: string;
  /** "Now", for the weeks-so-far count. Defaults to the clock. */
  readonly now?: Instant;
}

/** "3 Aug 2026". A day key and a word table — nothing ICU decides (LESSONS §3a). */
function dayLabel(day: DayKey, withYear: boolean): string {
  const label = `${Number(day.slice(8, 10))} ${monthName(day).slice(0, 3)}`;
  return withYear ? `${label} ${day.slice(0, 4)}` : label;
}

/**
 * Whole weeks elapsed between two days — 33 days is "4 weeks". Elapsed time
 * rather than `weeksBetween`, which counts Monday boundaries crossed and would
 * call Saturday to Monday a week: this line answers "how long have I been at
 * it", and a rider reads that as a duration.
 */
function weeksElapsed(from: DayKey, to: DayKey): number {
  return Math.floor(Math.max(0, daysBetween(from, to)) / 7);
}

function weeksLabel(weeks: number): string {
  if (weeks <= 0) return 'under a week';
  return weeks === 1 ? '1 week' : `${weeks} weeks`;
}

/**
 * A rider's history with one trick: every stage they have logged for it, oldest
 * first, with the first landing marked, and a one-line summary.
 *
 * The summary is written from the **learning** start rather than the first row.
 * "Want to learn" is a bookmark, not an attempt, so "Learning since" counts
 * from the first entry past it — which is what the design's "since 5 Aug"
 * meant when the timeline above it began on the 3rd. A trick logged straight
 * in at a landed stage has no learning to measure and says "Landed 17 Aug"
 * instead. A trick with only a "Want to learn" row says so, in that stage's
 * own words. Weeks are elapsed weeks — 33 days is "4 weeks" — and under seven
 * days says so rather than rounding to one.
 *
 * Every string here is built from day keys and two word tables, so the page
 * can hand them to a client component without a hydration risk (LESSONS §3a).
 */
export function trickHistory(
  log: readonly TrickLogEntry[],
  slug: string,
  options: TrickHistoryOptions = {},
): TrickHistory {
  const timezone = options.timezone || DEFAULT_TIMEZONE;
  const rows = chronological(log).filter((entry) => entry.trick === slug);
  const landedIndex = rows.findIndex((entry) => isLandedStage(entry.stage));

  const entries: TrickHistoryEntry[] = rows.map((entry, index) => ({
    stage: entry.stage,
    at: entry.at,
    estimated: entry.estimated === true,
    firstLanded: index === landedIndex,
    dateLabel: dayLabel(toDayKey(entry.at, timezone), true),
  }));

  const first = rows[0];
  if (!first) return { entries, summary: 'Nothing logged yet' };

  const start = rows.find((entry) => entry.stage !== 'want') ?? first;
  const startDay = toDayKey(start.at, timezone);
  const landed = landedIndex >= 0 ? rows[landedIndex] : undefined;

  if (landed) {
    if (landed === start) {
      return { entries, summary: `Landed ${dayLabel(toDayKey(landed.at, timezone), false)}` };
    }
    const weeks = weeksElapsed(startDay, toDayKey(landed.at, timezone));
    return { entries, summary: `${STAGE[start.stage].label} to landed in ${weeksLabel(weeks)}` };
  }

  const weeks = weeksElapsed(startDay, toDayKey(options.now ?? Date.now(), timezone));
  return {
    entries,
    summary: `${STAGE[start.stage].label} since ${dayLabel(startDay, false)} · ${weeksLabel(weeks)}`,
  };
}
