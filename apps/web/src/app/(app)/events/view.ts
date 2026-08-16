import {
  SPORTS,
  eventDateBlock,
  eventKindColor,
  eventKindsPresent,
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
}

export interface EventsView {
  readonly events: readonly EventView[];
  /** Only the kinds present in the list, so no pill finds nothing. */
  readonly kinds: readonly { readonly id: EventKind; readonly color: string }[];
  /** How many live events each sport has, for the tab notes. */
  readonly countBySport: Readonly<Record<string, number>>;
  readonly goingCount: number;
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
  };
}
