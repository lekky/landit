import {
  SPORTS,
  eventCountriesPresent,
  eventDateBlock,
  eventKindColor,
  eventKindsPresent,
  eventMapsLink,
  eventPhoneLink,
  eventSourceHost,
  eventSourceLink,
  eventsFor,
  isEventPast,
  sortedEvents,
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

export interface EventsView {
  readonly events: readonly EventView[];
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
}

export function buildEventsView(input: EventsViewInput): EventsView {
  const list = sortedEvents(input.events);

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
    countBySport[sport] = eventsFor(sport, input.events).length;
  }

  return {
    events,
    kinds: eventKindsPresent(input.events).map((id) => ({ id, color: eventKindColor(id) })),
    countBySport,
    goingCount: events.filter((e) => e.going).length,
    countries: eventCountriesPresent(input.events),
  };
}
