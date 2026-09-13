import { EVENTS } from '../data/events';
import type { EventKind, LandItEvent, LatLng, SportId } from '../types';
import { MONTH_LABELS } from './progress';
import { slugify } from './slug';
import {
  distanceLabelIn,
  hasCoords,
  mapsLink,
  sortSpotsByDistance,
  spotCountryForRegion,
  spotLatLng,
  type DistanceUnits,
} from './spots';
import { riderToday, type RiderClock } from './streak';
import { compareDayKeys, daysBetween, formatDayLong } from './time';

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
 * The country the calendar should **open** on for a reader in `region`, or
 * `null` for "Everywhere".
 *
 * `region` is an alpha-2 code from the only two signals this product has: a
 * signed-in rider's declared sign-up country, and — for a visitor with no
 * account — the `Accept-Language` region, which is a browser *setting* rather
 * than a location and is therefore the weaker of the two. Neither is stored,
 * and no coordinate of the reader's comes near this function.
 *
 * **It only ever names a country with events actually behind it** (Rachid,
 * 2026-09-12, in chat). The code-to-name join reaches roughly two hundred and
 * fifty countries and the calendar is in thirty of them, so the common case for
 * most of the planet is a reader whose own country has nothing on. Opening them
 * on an empty filter would be worse than opening them on the world, and
 * guessing a neighbour would be a country they never asked for — so the answer
 * there is `null`, which is exactly the "Everywhere" the screen shows today.
 * That is the same rule `eventCountriesPresent` applies to the `<select>`'s
 * options: nothing is offered that finds nothing.
 *
 * Pass the events **of the half being shown**, not the whole calendar — the
 * archive and the calendar are in different sets of countries, and a default
 * taken from the wrong half would filter one list to nothing.
 *
 * The name is joined through `SPOT_COUNTRY_BY_CODE` (`spotCountryForRegion`),
 * which is spot-named for where it was first needed but is simply the product's
 * one code-to-common-name table: both datasets spell a country the way a rider
 * reads it on a card ("USA", not "US"), and a second copy of that table is a
 * second thing to keep in step.
 */
export function eventCountryForRegion(
  region: string | null | undefined,
  events: readonly LandItEvent[] = EVENTS,
): string | null {
  const home = spotCountryForRegion(region);
  if (!home) return null;
  return eventCountriesPresent(events).includes(home) ? home : null;
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

/**
 * How Land The Trick names itself in somebody else's analytics.
 *
 * **A literal, and it must stay one.** It is tempting to derive this from
 * `SITE_URL` — one fact, one place — but this string is a key in a stranger's
 * reporting, not a fact about our deployment. Pointed at a staging host it
 * would quietly split an organiser's referral figures in two, and a rename
 * would orphan every visit recorded before it.
 */
export const EVENT_REFERRAL_SOURCE = 'landthetrick.com';

/**
 * The organiser's page with our referral on it, for an anchor a rider follows.
 *
 * **Why this exists at all.** Every outbound link on an event carries
 * `rel="noreferrer"`, deliberately: this is a children's product and the page a
 * child browsed from is not the organiser's business. The cost of that is that
 * an organiser sees our traffic as "direct" and has no way to know we sent it,
 * which is a poor answer for a list built out of their listings. These
 * parameters buy the credit back without the header: `utm_source` names *us*,
 * which is a fact about this site and not about the reader, and nothing else
 * travels — no event id, no page, no rider, no position.
 *
 * **`utm_medium=referral` because a source with no medium is filed under
 * "(not set)"** in GA4 and most of what else organisers run, which is a
 * statistic nobody reads. The two together put it in the referral report where
 * somebody will actually see it.
 *
 * **A URL that is already tagged is left exactly as it is.** Some researched
 * links are the organiser's own campaign URLs, tags and all; overwriting
 * `utm_source` there would move their visits out of the campaign they built and
 * into ours, which is worse for them than no credit at all. Their tagging wins.
 *
 * **Not for the maps links, and not for JSON-LD.** A `utm_source` on a Google
 * Maps search is noise, and `sameAs` in structured data is a claim about which
 * URL *is* the organiser's page — a tagged copy is a different URL and would be
 * a false one. Both keep `eventSourceLink` above, which is why this is a second
 * function rather than a change to that one.
 */
export function eventSourceReferralLink(url: string | null | undefined): string {
  const link = eventSourceLink(url);
  if (!link) return '';

  const parsed = new URL(link);
  for (const key of parsed.searchParams.keys()) {
    if (key.toLowerCase().startsWith('utm_')) return parsed.href;
  }

  parsed.searchParams.set('utm_source', EVENT_REFERRAL_SOURCE);
  parsed.searchParams.set('utm_medium', 'referral');
  return parsed.href;
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

/* ------------------------------------------- an event as its own page ----- */

/**
 * Which of the three states an event's own page is in.
 *
 * The date state is **derived, never stored** — an event does not change when
 * the day turns over, the reader does. `isEventPast` is the existing rule and
 * this adds only the middle case it cannot express on its own, so there is one
 * definition of "gone by" and not two.
 *
 * `RiderClock` carries the timezone, which is the whole reason this is not a
 * comparison against `new Date()` at the call site: an event in Auckland is
 * "today" for a rider in Auckland hours before it is for the server.
 */
export type EventDateState = 'upcoming' | 'today' | 'over';

export function eventDateState(event: LandItEvent, clock: RiderClock = {}): EventDateState {
  if (isEventPast(event, clock)) return 'over';
  return event.date === riderToday(clock) ? 'today' : 'upcoming';
}

/**
 * Whole days from the rider's today to the event's day: `21` for three weeks
 * off, `0` today, negative once it has been and gone.
 *
 * Day keys, not instants, so this is the same calendar-day arithmetic
 * everything else in the product uses and cannot drift by a timezone.
 */
export function eventDaysAway(event: LandItEvent, clock: RiderClock = {}): number {
  return daysBetween(riderToday(clock), event.date);
}

/**
 * "Saturday 26 September 2026" — the long date **with its year**.
 *
 * `formatDayLong` deliberately has no year: it writes the eyebrow on a
 * dashboard, where the year is always this one. An event page is the opposite
 * case — it is linkable, indexable and often read about something that happened
 * two summers ago, so a date without a year there is a date that lies by
 * omission. Composed from the same table-driven helper rather than from ICU,
 * for the reason `eventDateBlock` gives (LESSONS §3a).
 */
export function eventLongDate(date: string): string {
  return `${formatDayLong(date)} ${date.slice(0, 4)}`;
}

function agoLabel(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
}

/**
 * "12 weeks ago", for the finished-event band.
 *
 * Coarsens as it goes back, because that is how anybody talks about a date they
 * have to place rather than remember: days for the last fortnight, then weeks,
 * then months, then years. Never more precise than the underlying day key, and
 * never a fabricated time of day.
 *
 * Returns `''` for a day that has not passed — a caller asking "how long ago"
 * about tomorrow has asked the wrong question, and an empty string is a line
 * that does not render rather than a wrong one that does.
 */
export function eventAgoLabel(event: LandItEvent, clock: RiderClock = {}): string {
  const days = -eventDaysAway(event, clock);
  if (days <= 0) return '';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 183) return agoLabel(Math.round(days / 7), 'week');
  if (days < 730) return agoLabel(Math.round(days / 30.44), 'month');
  return agoLabel(Math.floor(days / 365.25), 'year');
}

/**
 * How close two listings are, given only a town and a country.
 *
 * **This is the honest limit of the data, written down.** Every event's
 * coordinates are its *town*, not its venue (issue #210, and the seed's own
 * header says so), so a radius in miles would be a number the data cannot back
 * — "3 miles away" implying a pin we do not hold. Two bands is what a town name
 * and a country name genuinely support, and nothing here interpolates between
 * them.
 *
 * Both comparisons are whole-string and case-insensitive, the same way
 * `eventMatchesCountry` compares: "India" must not select "Indonesia". A place
 * missing the field being compared matches nothing, rather than being quietly
 * filed under the reader's own town.
 */
export type Nearness = 'town' | 'country';

export interface NearPlace {
  readonly town?: string;
  readonly country?: string;
}

export function nearnessBetween(here: NearPlace, there: NearPlace): Nearness | null {
  const same = (a: string | undefined, b: string | undefined): boolean => {
    const left = (a ?? '').trim().toLowerCase();
    const right = (b ?? '').trim().toLowerCase();
    return left !== '' && left === right;
  };
  if (same(here.town, there.town)) return 'town';
  if (same(here.country, there.country)) return 'country';
  return null;
}

/**
 * The places near `here`, same town first and then the rest of the country,
 * with everything further away dropped rather than ordered.
 *
 * Order **within** each band is the caller's — events arrive soonest-first from
 * `sortedEvents` and stay that way, spots arrive alphabetically and stay that
 * way. A stable partition, not a sort, so nothing has to invent a tie-break.
 */
export function nearestFirst<T extends NearPlace>(here: NearPlace, places: readonly T[]): T[] {
  const town: T[] = [];
  const country: T[] = [];
  for (const place of places) {
    const near = nearnessBetween(here, place);
    if (near === 'town') town.push(place);
    else if (near === 'country') country.push(place);
  }
  return [...town, ...country];
}

/** How many rows an onward block shows before it becomes a list of its own. */
const ONWARD_LIMIT = 4;

function isSameVenue(a: LandItEvent, b: LandItEvent): boolean {
  const venue = (value: string): string => value.trim().toLowerCase();
  return (
    venue(a.venue) !== '' && venue(a.venue) === venue(b.venue) && nearnessBetween(a, b) === 'town'
  );
}

/**
 * Other live events a rider could go to instead of this one — the "what else is
 * on near X" block on an event's page.
 *
 * **Upcoming only, whatever state the page itself is in.** The block exists to
 * give a reader somewhere to go, and it is at its most useful on a finished
 * event, which is exactly where a second past event would be no use at all.
 *
 * The event itself is excluded by slug, and so is any other listing at the same
 * venue — those have their own block, and a row in both would read as a
 * duplicate.
 */
export function eventsNear(
  event: LandItEvent,
  events: readonly LandItEvent[] = EVENTS,
  options: { readonly clock?: RiderClock; readonly limit?: number } = {},
): LandItEvent[] {
  const clock = options.clock ?? {};
  const others = sortedEvents(events).filter(
    (other) => other.id !== event.id && !isEventPast(other, clock) && !isSameVenue(event, other),
  );
  return nearestFirst(event, others).slice(0, options.limit ?? ONWARD_LIMIT);
}

/**
 * The other live events at this venue — "also at Ventnor Skatepark".
 *
 * Matched on venue **and** town together, because a venue name alone is not
 * unique across a worldwide calendar: there is more than one Riverside
 * Skatepark, and joining two of them into one block would put a rider on a
 * plane.
 */
export function eventsAtVenue(
  event: LandItEvent,
  events: readonly LandItEvent[] = EVENTS,
  options: { readonly clock?: RiderClock; readonly limit?: number } = {},
): LandItEvent[] {
  const clock = options.clock ?? {};
  return sortedEvents(events)
    .filter(
      (other) => other.id !== event.id && isSameVenue(event, other) && !isEventPast(other, clock),
    )
    .slice(0, options.limit ?? ONWARD_LIMIT);
}

/**
 * One live event by its slug, or `null`.
 *
 * `sortedEvents` filters to `isLive`, so an event staff have hidden is not
 * found here — which is what makes a hidden event a 404 on its own page rather
 * than a page that quietly still works for anyone holding the URL.
 */
export function eventBySlug(
  slug: string,
  events: readonly LandItEvent[] = EVENTS,
): LandItEvent | null {
  return sortedEvents(events).find((event) => event.id === slug) ?? null;
}

/* ------------------------------------------------------- the archive ------ */

/**
 * The calendar, split in two, from **one** definition of "gone by".
 *
 * `/events` and `/events/past` are two views over the same collection, and the
 * prototype had them overlapping: an event that had happened showed up in the
 * upcoming list, and the archive carried things that had not happened yet. That
 * is not a filtering bug so much as a *two filters* bug — the moment each view
 * decides for itself what "past" means, the two answers drift, and a rider is
 * told an event is both coming up and over.
 *
 * So both halves are cut here, with `filterEvents`'s `upcomingOnly` doing the
 * cutting on one side and its exact complement on the other. `upcomingEvents`
 * and `pastEvents` are guaranteed disjoint and, between them, complete over
 * `sortedEvents` — `events.test.ts` asserts both properties rather than trusting
 * the two bodies to stay in step.
 *
 * The orders differ because the questions do. Upcoming is soonest-first: the
 * next thing you could go to is the top row. The archive is **most recent
 * first**: the thing somebody is looking up is almost always the last one that
 * happened, not the first one we ever listed.
 */
export function upcomingEvents(
  events: readonly LandItEvent[] = EVENTS,
  clock: RiderClock = {},
): LandItEvent[] {
  return filterEvents({ upcomingOnly: true, clock }, events);
}

export function pastEvents(
  events: readonly LandItEvent[] = EVENTS,
  clock: RiderClock = {},
): LandItEvent[] {
  const upcoming = new Set(upcomingEvents(events, clock).map((event) => event.id));
  return sortedEvents(events)
    .filter((event) => !upcoming.has(event.id))
    .reverse();
}

/**
 * The rider's own calendar: what they are down for, then what they have been
 * to (Rachid, 2026-09-13, in chat — a third tab beside Upcoming and Past).
 *
 * **Both halves in one list, in that order.** "I'm going" was write-only until
 * this existed: a rider could mark an event and the only thing the product ever
 * said back was a counter at the foot of the calendar. What they actually want
 * to ask is "what am I doing next, and what have I been to" — one question with
 * two tenses, which is why it is one list and not two screens.
 *
 * **It re-derives nothing.** The split is `upcomingEvents` / `pastEvents`, the
 * same pair every other events view is cut with, so a rider's own list cannot
 * disagree with the calendar about which tense an event is in — the failure
 * this whole file is arranged to prevent. Each half keeps its own order for its
 * own reason: what is coming is soonest-first, what has been is most recent
 * first.
 *
 * **`going` is slugs, and an unknown one is simply not here.** Attendance
 * outlives the listing it points at — staff can hide an event, and a rider's
 * row in `event_attendance` survives it — so a slug with nothing behind it is
 * an ordinary state rather than an error. Nobody else's attendance can reach
 * this function: `event_attendance` is `OWN`, so the only set that exists to
 * pass is the reader's own (plan §6.1).
 */
export function myEvents(
  going: ReadonlySet<string>,
  events: readonly LandItEvent[] = EVENTS,
  clock: RiderClock = {},
): LandItEvent[] {
  const mine = (event: LandItEvent) => going.has(event.id);
  return [...upcomingEvents(events, clock).filter(mine), ...pastEvents(events, clock).filter(mine)];
}

/**
 * A past event's town as a URL segment — `/events/past/2026/ventnor`.
 *
 * The same `slugify` every other public URL in the product is built with, so a
 * town with an accent or a hyphen in it resolves the same way here as it does
 * for a spot. Matching is done slug-to-slug rather than by comparing the
 * display names, because the segment is the only thing the reader's browser
 * sends back.
 */
export function eventTownSlug(town: string): string {
  return slugify(town ?? '');
}

/** One year-and-town corner of the archive that genuinely holds something. */
export interface EventArchiveCombination {
  readonly year: number;
  readonly town: string;
  readonly townSlug: string;
  readonly country: string;
  /** How many past events are behind it. Never zero — see {@link eventArchiveIndex}. */
  readonly count: number;
}

export interface EventArchiveIndex {
  /** Years with a past event in them, most recent first. */
  readonly years: readonly number[];
  /** Towns with a past event in them, alphabetically, with their country. */
  readonly towns: readonly { readonly town: string; readonly townSlug: string }[];
  /** Every combination that holds at least one event, most recent year first. */
  readonly combinations: readonly EventArchiveCombination[];
}

/**
 * What the archive index is allowed to offer.
 *
 * **Only combinations that actually contain events** (Rachid, 2026-09-06, in
 * chat). The obvious index is a year row crossed with a town row, and it is the
 * wrong one: eighty towns across four years is three hundred and twenty URLs of
 * which a couple of dozen hold anything, and the rest are thin pages a search
 * engine reads as a doorway pattern. The cap is not a display trick either —
 * `combinations` is what the index panel renders *and* what `sitemap.ts`
 * advertises, so there is one list and it cannot drift from the other.
 *
 * A combination a reader types by hand still resolves: the page renders the
 * design's empty state rather than a 500, and carries `robots: index: false` so
 * an empty corner can never become an indexed thin page. That is the page's
 * job, not this function's; what this guarantees is that nothing we *publish*
 * points at one.
 *
 * `en` is passed to `localeCompare` explicitly. The default reads the host's
 * locale, which differs between the server that renders the panel and the
 * browser that hydrates it, and a list in two orders across that boundary
 * throws the tree away rather than warning (LESSONS §3a).
 */
export function eventArchiveIndex(
  events: readonly LandItEvent[] = EVENTS,
  clock: RiderClock = {},
): EventArchiveIndex {
  const past = pastEvents(events, clock);

  const byKey = new Map<string, { year: number; town: string; country: string; count: number }>();
  for (const event of past) {
    const town = (event.town ?? '').trim();
    if (!town) continue;
    const townSlug = eventTownSlug(town);
    if (!townSlug) continue;
    const year = Number(event.date.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const key = `${year}/${townSlug}`;
    const found = byKey.get(key);
    if (found) found.count += 1;
    else byKey.set(key, { year, town, country: (event.country ?? '').trim(), count: 1 });
  }

  const combinations: EventArchiveCombination[] = [...byKey.values()]
    .map((entry) => ({ ...entry, townSlug: eventTownSlug(entry.town) }))
    .sort((a, b) => b.year - a.year || a.town.localeCompare(b.town, 'en'));

  const years = [...new Set(combinations.map((entry) => entry.year))].sort((a, b) => b - a);

  const townsBySlug = new Map<string, string>();
  for (const entry of combinations)
    if (!townsBySlug.has(entry.townSlug)) townsBySlug.set(entry.townSlug, entry.town);
  const towns = [...townsBySlug.entries()]
    .map(([townSlug, town]) => ({ town, townSlug }))
    .sort((a, b) => a.town.localeCompare(b.town, 'en'));

  return { years, towns, combinations };
}

/**
 * The past events in one corner of the archive.
 *
 * Both narrowings are optional and both are exact: a year is compared as a
 * number and a town slug-to-slug, so "Newport" cannot pick up "Newport Pagnell"
 * the way a prefix match would. An unknown year or town returns `[]`, which is
 * the empty state and not an error.
 */
export function pastEventsIn(
  where: { readonly year?: number | null; readonly townSlug?: string | null },
  events: readonly LandItEvent[] = EVENTS,
  clock: RiderClock = {},
): LandItEvent[] {
  return pastEvents(events, clock).filter((event) => {
    if (where.year != null && Number(event.date.slice(0, 4)) !== where.year) return false;
    if (where.townSlug && eventTownSlug(event.town) !== where.townSlug) return false;
    return true;
  });
}
