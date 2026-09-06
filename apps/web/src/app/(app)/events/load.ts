import {
  DEFAULT_TIMEZONE,
  SPORT_IDS,
  regionFromAcceptLanguage,
  sportsOf,
  unitsForCountry,
  type DistanceUnits,
  type SportId,
} from '@landit/core';
import { eventsFromRecords, listEventAttendance, listEvents } from '@landit/db';
import { headers } from 'next/headers';

import { anonymousClient, currentRider } from '@/lib/session';

import { buildEventsView, type EventsScope, type EventsView } from './view';

/**
 * One read of the calendar, shaped for whichever half is being shown.
 *
 * `/events` and `/events/past` (and `/events/past/[year]/[town]`) are the same
 * query, the same attendance join and the same units resolution over the same
 * collection — the only thing that differs is which half `buildEventsView` cuts
 * and whether it is narrowed to a year and a town. Three copies of this would
 * be three places for the "a visitor has no attendance to fetch" rule and the
 * `Accept-Language` fallback to drift apart, which is exactly the kind of
 * difference nothing in CI would notice.
 */
export interface LoadedEvents {
  readonly view: EventsView;
  readonly units: DistanceUnits;
  readonly signedIn: boolean;
}

export async function loadEvents(
  scope: EventsScope = 'upcoming',
  where: { readonly year: number; readonly townSlug: string } | null = null,
): Promise<LoadedEvents> {
  const session = await currentRider();
  const client = session?.client ?? anonymousClient();

  /*
   * A visitor has no attendance to fetch — and asking anyway would be a request
   * the `OWN` rule can only answer with an empty list. The two reads are still
   * one round trip for a rider.
   */
  const [eventRecords, attendance] = await Promise.all([
    listEvents(client),
    session ? listEventAttendance(client, session.rider.id) : Promise.resolve([]),
  ]);

  // Attendance relates to the event *record*; everything else here keys by
  // slug, so the two are joined once, in the one place that knows both.
  const slugOf = new Map(eventRecords.map((e) => [e.id, e.slug]));
  const going = new Set<string>();
  for (const row of attendance) {
    const slug = slugOf.get(row.event);
    if (slug) going.add(slug);
  }

  const region = session
    ? session.rider.country || regionFromAcceptLanguage((await headers()).get('accept-language'))
    : regionFromAcceptLanguage((await headers()).get('accept-language'));

  const view = buildEventsView({
    events: eventsFromRecords(eventRecords),
    /*
     * A visitor gets every sport, not `sportsOf`'s lone-rider default of
     * scooter: the shell shows a visitor all three tabs, and a tab whose note
     * is missing from `countBySport` reads as "0 on" — a calendar that looks
     * empty for skate and BMX before anybody has filtered anything.
     */
    sports: session ? sportsOf({ sports: session.rider.sports as SportId[] }) : [...SPORT_IDS],
    going,
    clock: { timezone: session?.rider.timezone || DEFAULT_TIMEZONE },
    scope,
    where,
  });

  return { view, units: unitsForCountry(region), signedIn: Boolean(session) };
}
