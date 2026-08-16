import { EVENTS } from '../data/events';
import type { EventKind, LandItEvent, SportId } from '../types';
import { MONTH_LABELS } from './progress';
import { riderToday, type RiderClock } from './streak';
import { compareDayKeys, formatDayLong } from './time';

/**
 * Events: comps, sessions, classes and jams that staff put on the calendar.
 *
 * Everything here is a pure read over the event list — there is no rider state
 * in an event beyond "I'm going", which is a row in `event_attendance` and not
 * a rule. What earns a module is the filtering, the ordering and the two date
 * labels, all of which the screen would otherwise do inline and none of which
 * may come out of ICU (see `eventDateBlock`).
 *
 * **Nothing here enumerates sports.** `eventsFor` takes whichever sport it is
 * given and an event carries a list, so a BMX-only event needs no code (plan
 * §7, "three sports, not two").
 */

/** Kind colours, from `EV_KINDS` in `design-handoff/design/landit-screens-d.jsx`. */
export const EVENT_KIND_COLORS = {
  Comp: '#FF5A1F',
  Session: '#10A06A',
  Class: '#246BFF',
  Jam: '#8A3BE0',
} as const satisfies Record<EventKind, string>;

/** The kinds, in the order the filter row offers them. */
export const EVENT_KIND_IDS = [
  'Comp',
  'Session',
  'Class',
  'Jam',
] as const satisfies readonly EventKind[];

/** A kind's colour, falling back to ink for one the design never named. */
export function eventKindColor(kind: string): string {
  const colors: Readonly<Record<string, string>> = EVENT_KIND_COLORS;
  return colors[kind] ?? 'var(--ink)';
}

/** Live events, soonest first. Hidden ones are not merely filtered — they are gone. */
export function sortedEvents(events: readonly LandItEvent[] = EVENTS): LandItEvent[] {
  return events.filter((e) => e.isLive).sort((a, b) => compareDayKeys(a.date, b.date));
}

/** Live events good for one sport, soonest first. */
export function eventsFor(sport: SportId, events: readonly LandItEvent[] = EVENTS): LandItEvent[] {
  return sortedEvents(events).filter((e) => e.sports.includes(sport));
}

/**
 * The kinds actually present in a list, in the canonical order — so the filter
 * row offers "Class" only when there is a class to find, exactly as the
 * prototype derives its pills from the data rather than from a constant.
 */
export function eventKindsPresent(events: readonly LandItEvent[] = EVENTS): EventKind[] {
  const present = new Set(sortedEvents(events).map((e) => e.kind));
  return EVENT_KIND_IDS.filter((kind) => present.has(kind));
}

/** How the list is narrowed: by kind, and to one sport or all of them. */
export interface EventQuery {
  /** A kind, or `null` for every kind. */
  readonly kind?: EventKind | null;
  /** A sport, or `null` for "every sport". */
  readonly sport?: SportId | null;
  /** Drop events whose day has already passed, in the rider's timezone. */
  readonly upcomingOnly?: boolean;
  readonly clock?: RiderClock;
}

/** The list a rider is looking at, soonest first. */
export function filterEvents(
  query: EventQuery = {},
  events: readonly LandItEvent[] = EVENTS,
): LandItEvent[] {
  const today = query.upcomingOnly ? riderToday(query.clock ?? {}) : null;
  return sortedEvents(events).filter((event) => {
    if (query.kind && event.kind !== query.kind) return false;
    if (query.sport && !event.sports.includes(query.sport)) return false;
    if (today && compareDayKeys(event.date, today) < 0) return false;
    return true;
  });
}

/** Has this event's day already gone by, where the rider is? */
export function isEventPast(event: LandItEvent, clock: RiderClock = {}): boolean {
  return compareDayKeys(event.date, riderToday(clock)) < 0;
}

/**
 * The coloured date block on the left of each row: "29" over "AUG".
 *
 * Built from the day key and a table, never from `toLocaleDateString`. This
 * renders on a page that hydrates, and anything locale-derived is a hydration
 * risk that throws the tree away rather than warning about it (LESSONS §3a).
 * The `.lab` class uppercases the month on screen; the value is returned in the
 * table's own case so a caller is not stuck with a shouted string.
 */
export interface EventDateBlock {
  /** Day of the month, no leading zero: "5", "29". */
  readonly day: string;
  /** Short month: "Aug". */
  readonly month: string;
  /** "Saturday 29 August", for the detail modal. */
  readonly full: string;
}

export function eventDateBlock(date: string): EventDateBlock {
  const day = String(Number(date.slice(8, 10)));
  const month = MONTH_LABELS[Number(date.slice(5, 7)) - 1] ?? '';
  return { day, month, full: formatDayLong(date) };
}
