import { TRICKS } from '../data/tricks';
import type { Instant, SportId, Trick, TrickLogEntry } from '../types';
import { DEFAULT_TIMEZONE, toDayKey } from './time';
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
  /** Short month name, e.g. "Aug". */
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
