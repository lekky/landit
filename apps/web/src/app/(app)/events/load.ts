import {
  DEFAULT_TIMEZONE,
  SPORT_IDS,
  regionFromAcceptLanguage,
  unitsForCountry,
  type DistanceUnits,
} from '@landit/core';
import { eventsFromRecords, listEventAttendance, listEvents } from '@landit/db';
import { headers } from 'next/headers';

import { anonymousClient, currentRider } from '@/lib/session';

import { buildEventsView, type EventsScope, type EventsView } from './view';

/**
 * One read of the calendar, shaped for whichever tab is being shown.
 *
 * `/events`, `/events/past` (with `/events/past/[year]/[town]`) and
 * `/events/mine` are the same query, the same attendance join and the same
 * units resolution over the same collection — the only thing that differs is
 * which slice `buildEventsView` cuts and whether it is narrowed to a year and a
 * town. Four copies of this would be four places for the "a visitor has no
 * attendance to fetch" rule and the `Accept-Language` fallback to drift apart,
 * which is exactly the kind of difference nothing in CI would notice.
 *
 * The attendance join was always here, for every scope, because every scope's
 * rows carry a "✓ Going" state and the tab count sits on all three screens —
 * so `/events/mine` needed no new read, only a different cut.
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
     * Every sport, for everybody — a rider's own `users.sports` is not consulted
     * here any more (Rachid, 2026-09-12, in chat).
     *
     * This used to be the rider's sports, because the screen's filter could
     * only reach the sport the global switch was on. The filter is now a
     * multi-select over `SPORT_IDS` (`SportFilter`), so a rider who records
     * only skate can still ask for BMX — and a count missing from
     * `countBySport` would render on that BMX pill as "0" while the calendar
     * behind it was full.
     */
    sports: [...SPORT_IDS],
    going,
    clock: { timezone: session?.rider.timezone || DEFAULT_TIMEZONE },
    scope,
    where,
    /*
     * Which country the list opens on. The same signal the units already use,
     * and resolved in the same order — a declared sign-up country beats a
     * browser setting — so a reader cannot be shown miles by one rule and
     * filed under a different country by the other.
     */
    region,
  });

  return { view, units: unitsForCountry(region), signedIn: Boolean(session) };
}
