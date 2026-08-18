import { EVENTS } from '../data/events';
import type { EventKind, LandItEvent, LatLng, SportId } from '../types';
import { MONTH_LABELS } from './progress';
import {
  distanceLabelIn,
  hasCoords,
  mapsLink,
  sortSpotsByDistance,
  spotLatLng,
  type DistanceUnits,
} from './spots';
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
  /**
   * A country's common English name, or `null` for every country.
   *
   * Matched whole-string and never as a prefix: "India" must not select
   * "Indonesia", and a filter built from the countries actually present has no
   * reason to guess.
   */
  readonly country?: string | null;
  /** Free text over the name, town, venue and country. */
  readonly search?: string;
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
    if (!eventMatchesCountry(event, query.country ?? null)) return false;
    if (!eventMatchesSearch(event, query.search ?? '')) return false;
    return true;
  });
}

/* ------------------------------------------------------------ where it is -- */

/**
 * Is this event in that country?
 *
 * Whole-string and case-insensitive. An event with no country recorded matches
 * nothing but "everywhere", which is the honest answer for a listing nobody has
 * finished researching — it is not quietly filed under the reader's own country.
 */
export function eventMatchesCountry(event: LandItEvent, country: string | null): boolean {
  if (!country) return true;
  return (event.country ?? '').trim().toLowerCase() === country.trim().toLowerCase();
}

/**
 * The countries present in a list, alphabetically, for the country filter.
 *
 * Derived from the data rather than from a constant, exactly as
 * `eventKindsPresent` derives the kind pills: a filter offering a country with
 * nothing behind it can only disappoint. Events with no country contribute
 * nothing and stay reachable through "Everywhere".
 *
 * Sorted with an explicit `en` locale. The default reads the *host's* locale,
 * which differs between the server that renders this list and the browser that
 * hydrates it, and a list in two different orders across that boundary is a
 * hydration mismatch that throws the tree away rather than warning (LESSONS §3a).
 */
export function eventCountriesPresent(events: readonly LandItEvent[] = EVENTS): string[] {
  const present = new Set<string>();
  for (const event of sortedEvents(events)) {
    const country = (event.country ?? '').trim();
    if (country) present.add(country);
  }
  return [...present].sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * Free-text match over the things a rider actually types: a city, a venue, an
 * event's name, a country.
 *
 * This is the "enter a city" half of the location controls, and it is
 * deliberately a substring test over four fields rather than a geocoder. A
 * rider typing "Leeds" wants the Leeds row; sending the string to a geocoding
 * service would put every search a child performs into a third party's logs to
 * answer a question `includes` already answers.
 */
export function eventMatchesSearch(event: LandItEvent, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [event.name, event.town, event.venue, event.country ?? '']
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

/** Has this event somewhere to be plotted? `0, 0` is absent, not Null Island. */
export function eventHasCoords(event: Pick<LandItEvent, 'lat' | 'lng'>): boolean {
  return hasCoords(event);
}

/** The event's point, or `null` if it has none. */
export function eventLatLng(event: Pick<LandItEvent, 'lat' | 'lng'>): LatLng | null {
  return spotLatLng(event);
}

/**
 * A link that opens the venue in whatever maps app the rider has.
 *
 * The same `?api=1` search URL the spots screen uses, carrying the *venue's*
 * coordinates and nothing about the rider — no origin, no "directions from
 * here" (plan §6.4 standard 10).
 */
export function eventMapsLink(event: Pick<LandItEvent, 'lat' | 'lng'>): string {
  return mapsLink(event);
}

/** "2.4 mi" or "3.9 km", from wherever the rider says they are. */
export function eventDistanceLabel(
  from: LatLng,
  event: Pick<LandItEvent, 'lat' | 'lng'>,
  units: DistanceUnits,
): string | null {
  return distanceLabelIn(from, event, units);
}

/**
 * Nearest first, from wherever the rider says they are.
 *
 * Delegates to `sortSpotsByDistance`, whose contract is exactly the one wanted
 * here and which an event satisfies structurally: the point is an argument and
 * no copy of it is kept, because the rider's position is not ours to hold (plan
 * §6.4 standard 10). Events with no coordinates keep their order and go last —
 * they cannot be near anything.
 */
export function sortEventsByDistance<T extends LandItEvent>(
  events: readonly T[],
  from: LatLng,
): T[] {
  return sortSpotsByDistance(events, from);
}

/* ----------------------------------------------------------- links out ----- */

/**
 * The organiser's own page for an event, or `''` when there is nothing safe to
 * link to.
 *
 * **The scheme check is here, at render time, and that is the point.** This URL
 * is typed by staff into the admin editor and stored as free text, so nothing
 * between the keyboard and the `href` validates it. A `javascript:` or `data:`
 * URI in an `href` runs against the rider's own session when tapped; returning
 * `''` for anything that is not `http:` or `https:` makes the worst case a
 * missing link rather than a working attack. A format check at save time would
 * put the guard in the weaker place — it is bypassed by any writer that is not
 * the form, and it is not what the browser consults when the link is followed.
 */
export function eventSourceLink(url: string | null | undefined): string {
  const raw = (url ?? '').trim();
  if (!raw) return '';
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return '';
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
}

/** The bare host, so a rider can see where a link goes before following it. */
export function eventSourceHost(url: string | null | undefined): string {
  const link = eventSourceLink(url);
  if (!link) return '';
  return new URL(link).hostname.replace(/^www\./, '');
}

/**
 * A `tel:` link for the venue's number, or `''` when there is nothing dialable.
 *
 * The stored string is never reformatted — see the migration — but a `tel:` URI
 * may carry only digits and a leading `+`, so everything else is dropped *for
 * the link* while the text on screen stays exactly as the venue published it. A
 * string that reduces to fewer than five digits is not a phone number and gets
 * no link rather than a broken one.
 */
export function eventPhoneLink(phone: string | null | undefined): string {
  const raw = (phone ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 5) return '';
  return `tel:${raw.trimStart().startsWith('+') ? '+' : ''}${digits}`;
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
