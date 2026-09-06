import {
  SPORTS,
  eventAgoLabel,
  eventArchiveIndex,
  eventCountriesPresent,
  eventDateBlock,
  eventKindColor,
  eventKindsPresent,
  eventMapsLink,
  eventPhoneLink,
  eventSourceHost,
  eventSourceLink,
  eventTownSlug,
  eventsFor,
  isEventPast,
  pastEventsIn,
  upcomingEvents,
  type EventArchiveIndex,
  type EventKind,
  type LandItEvent,
  type SportId,
} from '@landit/core';

/**
 * The events list, computed on the server (screenshot 18,
 * `landit-screens-d.jsx`'s `Events`).
 *
 * Same shape as Challenge and Progress and for the same reason: the sport tabs
 * and the kind filter are client state, so the component renders on both sides
 * of a hydration boundary and no date on it may come out of ICU. The prototype
 * builds its date block with `toLocaleDateString`; `eventDateBlock` builds it
 * from a table (LESSONS §3a).
 *
 * Filtering happens in the browser — the whole list is a handful of rows, and a
 * round trip per pill would make the filter row feel broken. What the server
 * does is shape each row once.
 */

export interface EventView {
  readonly id: string;
  readonly name: string;
  readonly kind: EventKind;
  readonly kindColor: string;
  readonly day: string;
  readonly month: string;
  readonly fullDate: string;
  readonly venue: string;
  readonly town: string;
  readonly level: string;
  readonly price: string;
  readonly places: string;
  readonly blurb: string;
  /** Sport chips, in the sports' own order. */
  readonly sports: readonly {
    readonly id: SportId;
    readonly label: string;
    readonly color: string;
    readonly icon: string;
  }[];
  /** Sport ids, for the "good for X" filter. */
  readonly sportIds: readonly SportId[];
  readonly going: boolean;
  /** Already been and gone, on the rider's calendar. */
  readonly past: boolean;
  /**
   * "12 weeks ago", for an archive row's meta line. `''` for anything that has
   * not happened, which is a line that does not render rather than a wrong one
   * that does (`eventAgoLabel`).
   */
  readonly ago: string;

  /*
   * Where it is and where the listing came from. Every one of these is `''`
   * when the research did not find it, and the screen renders each line only
   * when it has one — an event with no phone shows no phone row, rather than a
   * label with nothing after it.
   */
  readonly country: string;
  readonly address: string;
  /** As published. `phoneLink` is the dialable form; this is what is shown. */
  readonly phone: string;
  readonly phoneLink: string;
  /** Already scheme-checked: `''` unless it is a real http(s) URL. */
  readonly sourceUrl: string;
  /** "rampworx.com" — where that link goes, before a rider follows it. */
  readonly sourceHost: string;
  /** Google Maps for the venue, or `''` when there is no point to open. */
  readonly mapsUrl: string;
  /** The venue's point, for "Near me". Both `undefined` when unplottable. */
  readonly lat?: number;
  readonly lng?: number;
}

/**
 * Which half of the calendar a screen is showing.
 *
 * The two are **routes**, not a pill: `/events` and `/events/past`. The archive
 * is the half worth arriving on from a search result, and a filter has no
 * address. It also settles the prototype's bug outright — a view that cannot
 * express "both" cannot leak one into the other (`upcomingEvents` /
 * `pastEvents`, and the property test beside them).
 */
export type EventsScope = 'upcoming' | 'past';

/** The corner of the archive a page is narrowed to, if any. */
export interface ArchiveWhere {
  readonly year: number;
  readonly townSlug: string;
  /** The town as it is written, for the copy. Empty for one nobody has heard of. */
  readonly town: string;
}

/**
 * What the archive's index panel offers, and what the sitemap advertises.
 *
 * The same list for both, deliberately: it comes from `eventArchiveIndex`,
 * which only ever names year-and-town corners with events actually in them
 * (Rachid, 2026-09-06, in chat — the index is capped rather than a
 * cross-product). One list means the panel and the sitemap cannot drift into
 * disagreeing about which pages exist.
 */
export interface ArchiveView {
  readonly index: EventArchiveIndex;
  /** Where this page is narrowed to, or `null` for the whole archive. */
  readonly where: ArchiveWhere | null;
}

export interface EventsView {
  readonly events: readonly EventView[];
  /** Which half of the calendar these events are. */
  readonly scope: EventsScope;
  /** How many events each half holds, for the segmented control's counts. */
  readonly upcomingCount: number;
  readonly pastCount: number;
  /** Present on the archive only. */
  readonly archive: ArchiveView | null;
  /** Only the kinds present in the list, so no pill finds nothing. */
  readonly kinds: readonly { readonly id: EventKind; readonly color: string }[];
  /** How many live events each sport has, for the tab notes. */
  readonly countBySport: Readonly<Record<string, number>>;
  readonly goingCount: number;
  /**
   * The countries with an event behind them, alphabetically — the options the
   * country filter offers. Computed on the server so the `<select>` renders
   * identically on both sides of hydration (LESSONS §3a).
   */
  readonly countries: readonly string[];
}

export interface EventsViewInput {
  readonly events: readonly LandItEvent[];
  readonly sports: readonly SportId[];
  /** Event slugs this rider is down for. */
  readonly going: ReadonlySet<string>;
  readonly clock: { readonly timezone: string };
  /** Which half to shape. Defaults to the calendar. */
  readonly scope?: EventsScope;
  /**
   * A corner of the archive, from `/events/past/[year]/[town]`. Ignored on the
   * upcoming half. A corner with nothing in it is not an error — it is the
   * design's empty state, and the page that renders it carries `noindex`.
   */
  readonly where?: { readonly year: number; readonly townSlug: string } | null;
}

export function buildEventsView(input: EventsViewInput): EventsView {
  const scope: EventsScope = input.scope ?? 'upcoming';

  /*
   * The split is `@landit/core`'s, on both sides, and nothing here re-derives
   * it. That is the whole fix for the handoff's recorded bug: the moment a
   * screen decides for itself what "past" means there are two definitions, and
   * a rider is eventually told an event is both coming up and over.
   */
  const upcoming = upcomingEvents(input.events, input.clock);
  const archiveAll = pastEventsIn({}, input.events, input.clock);

  const where =
    scope === 'past' && input.where
      ? { year: input.where.year, townSlug: input.where.townSlug }
      : null;

  const list =
    scope === 'past'
      ? where
        ? pastEventsIn(where, input.events, input.clock)
        : archiveAll
      : upcoming;

  const events: EventView[] = list.map((event) => {
    const date = eventDateBlock(event.date);
    return {
      id: event.id,
      name: event.name,
      kind: event.kind,
      kindColor: eventKindColor(event.kind),
      day: date.day,
      month: date.month,
      fullDate: date.full,
      venue: event.venue,
      town: event.town,
      level: event.level,
      price: event.price,
      places: event.spots,
      blurb: event.blurb,
      sports: event.sports.map((id) => ({
        id,
        label: SPORTS[id].short,
        color: SPORTS[id].color,
        icon: SPORTS[id].icon,
      })),
      sportIds: [...event.sports],
      going: input.going.has(event.id),
      past: isEventPast(event, input.clock),
      ago: eventAgoLabel(event, input.clock),
      country: event.country ?? '',
      address: event.address ?? '',
      phone: event.phone ?? '',
      phoneLink: eventPhoneLink(event.phone),
      // Scheme-checked here, once, so no component can render an unchecked
      // `href` — the check belongs between the data and the DOM, not in a
      // component that might be copied without it.
      sourceUrl: eventSourceLink(event.sourceUrl),
      sourceHost: eventSourceHost(event.sourceUrl),
      mapsUrl: eventMapsLink(event),
      ...(event.lat === undefined ? {} : { lat: event.lat }),
      ...(event.lng === undefined ? {} : { lng: event.lng }),
    };
  });

  // Counted off the rider's own sports, whatever they are — never a literal
  // pair (plan §7, "three sports, not two").
  const countBySport: Record<string, number> = {};
  for (const sport of input.sports) {
    // Counted within the half on screen: on the archive "12 on" has to mean
    // twelve past events, not twelve on the whole calendar.
    countBySport[sport] = eventsFor(sport, scope === 'past' ? archiveAll : upcoming).length;
  }

  /*
   * The pills and the country list are derived from **the half on screen**, not
   * from the whole calendar. A kind pill on the archive that finds nothing is
   * the same disappointment `eventKindsPresent` was written to avoid, and it
   * would be a new one: every past event is a Session in a town nobody has
   * filtered to yet.
   */
  const inScope = scope === 'past' ? archiveAll : upcoming;

  return {
    events,
    scope,
    upcomingCount: upcoming.length,
    pastCount: archiveAll.length,
    archive:
      scope === 'past'
        ? {
            index: eventArchiveIndex(input.events, input.clock),
            where: where
              ? {
                  ...where,
                  /*
                   * The town as somebody writes it, taken from an event that is
                   * actually in that corner — never from the URL segment, which
                   * is a string a reader typed and would put their words into
                   * the page's own copy.
                   */
                  town:
                    list.find((event) => eventTownSlug(event.town) === where.townSlug)?.town ??
                    archiveAll.find((event) => eventTownSlug(event.town) === where.townSlug)
                      ?.town ??
                    '',
                }
              : null,
          }
        : null,
    kinds: eventKindsPresent(inScope).map((id) => ({ id, color: eventKindColor(id) })),
    countBySport,
    goingCount: events.filter((e) => e.going).length,
    countries: eventCountriesPresent(inScope),
  };
}
