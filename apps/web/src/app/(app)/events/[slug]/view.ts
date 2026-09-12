import {
  SPORTS,
  eventAgoLabel,
  eventDateBlock,
  eventDateState,
  eventDaysAway,
  eventKindColor,
  eventLatLng,
  eventLongDate,
  eventMapsLink,
  eventPhoneLink,
  eventSourceHost,
  eventSourceReferralLink,
  eventsAtVenue,
  eventsNear,
  nearestFirst,
  weekdayName,
  type EventDateState,
  type LandItEvent,
  type LatLng,
  type Spot,
  type SportId,
} from '@landit/core';
import type { Route } from 'next';

import { ROUTES, eventHref, spotHref } from '@/lib/routes';

/**
 * One event, shaped for its own page.
 *
 * The list's `view.ts` next door does the same job for a row, and this is its
 * long-form sibling rather than a replacement: the modal's fields are all here,
 * because "promote the modal to a page" is exactly what this screen is, plus
 * the four things a modal cannot carry — a real heading, the date state, the
 * map's claim about its own accuracy, and somewhere to go next.
 *
 * **Everything is settled here, on the server.** The page is crawlable and its
 * whole reason for existing is that a machine reading the markup sees the same
 * thing a rider does, so no date, no countdown and no "over" badge may be
 * painted after hydration. Nothing below touches ICU either, for the reason
 * `eventDateBlock` gives (LESSONS §3a).
 */

/** A row in an onward block: one link out of this page, or one row that is not one yet. */
export interface OnwardRow {
  readonly key: string;
  /** The 5.4rem left column: a short date for an event, a type for a spot. */
  readonly lead: string;
  readonly name: string;
  /** The right-aligned note: where it is, what is there. */
  readonly meta: string;
  /**
   * Where the row goes, when there is anywhere to send it.
   *
   * Absent renders the row as a row rather than as a link — the pattern
   * LESSONS §3a settles for a screen built before its neighbour exists.
   * `/spots/[slug]` is being built beside this one and does not exist on this
   * branch, so a spot row is a row today and an anchor the moment that page
   * lands.
   */
  readonly href?: Route;
}

export interface OnwardBlock {
  readonly id: string;
  readonly heading: string;
  readonly rows: readonly OnwardRow[];
  readonly more?: { readonly label: string; readonly href: Route };
  /** A line under the list, where the list needs one to be honest. */
  readonly note?: string;
}

export interface EventPageView {
  readonly slug: string;
  /** The event's own name, for a title and a share card. */
  readonly name: string;
  /** "Ride The Wight Jam, Ventnor" — the H1, which places it as well as names it. */
  readonly heading: string;
  readonly kind: string;
  readonly kindColor: string;
  readonly sports: readonly {
    readonly id: SportId;
    readonly label: string;
    readonly color: string;
    readonly icon: string;
  }[];
  readonly venue: string;
  readonly town: string;
  readonly country: string;
  /** "Ventnor Skatepark · Ventnor, United Kingdom". */
  readonly subLine: string;
  readonly blurb: string;
  readonly level: string;
  readonly price: string;
  readonly places: string;

  readonly address: string;
  readonly phone: string;
  readonly phoneLink: string;
  readonly sourceUrl: string;
  readonly sourceHost: string;
  /** Google Maps for the venue's point, or `''` when there is no point to open. */
  readonly mapsUrl: string;

  readonly state: EventDateState;
  /** Days from today, in the reader's timezone. Negative once it is over. */
  readonly daysAway: number;
  /** "Saturday 26 September 2026". */
  readonly longDate: string;
  /** "12 weeks ago", or `''` when it has not happened yet. */
  readonly agoLabel: string;
  /** The Date fact cell: "26 Sep 2026", and the qualifier under it. */
  readonly dateValue: string;
  readonly dateQualifier: string;
  /**
   * What the map is allowed to claim, or `''` when there is no point at all.
   *
   * The caption is not decoration: an event's coordinates are its town (issue
   * #210), and the map has to say so where a reader can see it.
   */
  readonly mapCaption: string;
  /**
   * The point the map is drawn on, or `null` when there is nothing to draw.
   *
   * It is the event's **town**, not its venue (issue #210), which is why the
   * page draws an area around it rather than a pin on it — see `EventArea`.
   */
  readonly point: LatLng | null;

  readonly onward: readonly OnwardBlock[];
}

export interface EventPageInput {
  readonly event: LandItEvent;
  /** Every live event, for the two onward blocks that read them. */
  readonly events: readonly LandItEvent[];
  /**
   * Live spots only — a pending submission is not a place to send anybody.
   *
   * Each carries the slug of its own page so the rows below can link to it.
   * The slug stays optional: `Spot` in `@landit/core` has no such field (a spot
   * is a place, not a record), so this is the caller handing over what it read
   * off the row it already had.
   */
  readonly spots: readonly (Spot & { readonly slug?: string })[];
  readonly clock: { readonly timezone: string };
}

/** "Sat 19 Sep" — the onward list's left column. */
function shortWhen(date: string): string {
  const block = eventDateBlock(date);
  return `${weekdayName(date).slice(0, 3)} ${block.day} ${block.month}`;
}

/** The Date cell's value and the line under it, which is the state in words. */
function dateCell(event: LandItEvent, state: EventDateState): { value: string; qualifier: string } {
  const block = eventDateBlock(event.date);
  const value = `${block.day} ${block.month} ${event.date.slice(0, 4)}`;
  if (state === 'over') return { value, qualifier: 'Finished' };
  if (state === 'today') return { value, qualifier: 'Today' };
  return { value, qualifier: weekdayName(event.date) };
}

export function buildEventPageView(input: EventPageInput): EventPageView {
  const { event, events, spots, clock } = input;
  const state = eventDateState(event, clock);
  const { value: dateValue, qualifier: dateQualifier } = dateCell(event, state);
  const country = event.country ?? '';

  const near = eventsNear(event, events, { clock });
  const atVenue = eventsAtVenue(event, events, { clock });
  /*
   * Spots are matched on the same two bands as events — same town, then the
   * rest of the country — because that is all either record supports. Ordered
   * within a band by whatever the caller handed over, which for
   * `listSpotsInPlace` is alphabetical, and capped at four so the block stays a
   * signpost rather than becoming a second spots list.
   *
   * The caller hands over the spots of this town and this country rather than
   * every spot there is, which is why the two bands above are also the two
   * queries it runs. `nearestFirst` is still the rule: the query is the looser
   * of the two and only exists so that thirty thousand rows are not read to
   * choose four.
   */
  const nearbySpots = nearestFirst(event, spots).slice(0, 4);

  const onward: OnwardBlock[] = [];

  if (near.length > 0) {
    onward.push({
      id: 'near',
      heading: `What else is on near ${event.town}`,
      more: { label: 'All events', href: ROUTES.events },
      rows: near.map((other) => ({
        key: other.id,
        lead: shortWhen(other.date),
        name: other.name,
        meta: [other.venue, other.town].filter(Boolean).join(' · '),
        href: eventHref(other.id),
      })),
      /*
       * Said out loud because the heading says "near" and the data cannot back
       * a distance: every coordinate we hold is a town centre (issue #210), so
       * "near" here means the same town and then the same country, and a row
       * two hundred miles away is possible. Better to state the rule than to
       * imply a radius.
       */
      note: country
        ? `Same town first, then the rest of ${country}. We hold towns rather than pins, so this is an area and not a distance.`
        : 'Same town first, then the same country. We hold towns rather than pins, so this is an area and not a distance.',
    });
  }

  if (atVenue.length > 0) {
    onward.push({
      id: 'venue',
      heading: `Also at ${event.venue}`,
      rows: atVenue.map((other) => ({
        key: other.id,
        lead: shortWhen(other.date),
        name: other.name,
        meta: [other.kind, other.price].filter(Boolean).join(' · '),
        href: eventHref(other.id),
      })),
    });
  }

  if (nearbySpots.length > 0) {
    onward.push({
      id: 'spots',
      heading: `Spots near ${event.town}`,
      /*
       * Linked, now that `/spots/[slug]` exists. This block shipped as plain
       * rows with a note saying spots had no pages yet, because that page was
       * being built beside it (LESSONS §3a) — it has since landed, and a row
       * that stays a row once its destination exists is a dead end with an
       * out-of-date apology under it. A spot with no slug is still a row.
       */
      rows: nearbySpots.map((spot) => ({
        key: `${spot.name}-${spot.town}`,
        lead: spot.type,
        name: spot.name,
        meta: [spot.town, ...spot.tags.slice(0, 2)].filter(Boolean).join(' · '),
        ...(spot.slug ? { href: spotHref(spot.slug) } : {}),
      })),
      more: { label: 'All spots', href: ROUTES.spots },
    });
  }

  return {
    slug: event.id,
    name: event.name,
    heading: `${event.name}, ${event.town}`,
    kind: event.kind,
    kindColor: eventKindColor(event.kind),
    sports: event.sports.map((id) => ({
      id,
      label: SPORTS[id].short,
      color: SPORTS[id].color,
      icon: SPORTS[id].icon,
    })),
    venue: event.venue,
    town: event.town,
    country,
    subLine: [event.venue, [event.town, country].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(' · '),
    blurb: event.blurb,
    level: event.level,
    price: event.price,
    places: event.spots,
    address: event.address ?? '',
    phone: event.phone ?? '',
    phoneLink: eventPhoneLink(event.phone),
    /*
     * Scheme-checked once, between the data and the DOM, exactly as the list's
     * view does it — no component may be handed an unchecked `href`. The
     * referral variant, because this string only ever becomes an anchor a rider
     * follows: `rel="noreferrer"` means the organiser cannot otherwise tell we
     * sent them, and `utm_source` is a fact about this site rather than about
     * the reader. The JSON-LD `sameAs` keeps the untagged URL — see
     * `eventSourceReferralLink`.
     */
    sourceUrl: eventSourceReferralLink(event.sourceUrl),
    sourceHost: eventSourceHost(event.sourceUrl),
    mapsUrl: eventMapsLink(event),
    state,
    daysAway: eventDaysAway(event, clock),
    longDate: eventLongDate(event.date),
    agoLabel: eventAgoLabel(event, clock),
    dateValue,
    dateQualifier,
    mapCaption: eventMapsLink(event)
      ? `${[event.town, country].filter(Boolean).join(', ')} — town-accurate, not the exact venue`
      : '',
    point: eventLatLng(event),
    onward,
  };
}
