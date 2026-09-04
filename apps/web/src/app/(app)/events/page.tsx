import {
  DEFAULT_TIMEZONE,
  SPORT_IDS,
  regionFromAcceptLanguage,
  sportsOf,
  unitsForCountry,
  type SportId,
} from '@landit/core';
import { eventsFromRecords, listEventAttendance, listEvents } from '@landit/db';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { ROUTES } from '@/lib/routes';
import { anonymousClient, currentRider } from '@/lib/session';

import { EventsScreen } from './EventsScreen';
import { buildEventsView } from './view';

export const metadata: Metadata = {
  title: 'Events · Land The Trick',
  description: 'Comps, coached sessions, classes and jams that staff have put on the calendar.',
  alternates: { canonical: ROUTES.events },
};

/**
 * Events (`landit-screens-d.jsx`, screenshot 18).
 *
 * **Readable signed out**, like `/spots` and the library. The `events`
 * collection's own rule is `is_live = true` with no auth arm — compare
 * `announcements` beside it, which adds `@request.auth.id != ''` deliberately —
 * so a live event has always been public data, and the sign-in redirect that
 * used to stand here was a gate the rules never asked for. What signing in adds
 * is "I'm going": `event_attendance` is `OWN`, so nobody else's attendance is
 * readable by anybody, which is why an attendee list is not on this screen and
 * never will be (plan §6.1 — no stranger-contact surface).
 *
 * **No onboarding bounce**, on the same grounds as `/spots`. A page a stranger
 * may read cannot coherently turn a signed-in rider away, and the only thing
 * onboarding settles for this screen is which sport tab opens — which has a
 * sensible answer for a visitor anyway.
 *
 * **Distances are in the reader's units, resolved here, on the server**, from
 * two signals with the weaker consulted only when the stronger is missing: a
 * signed-in rider's declared country wins, and a visitor is read from
 * `Accept-Language`, which is a browser setting rather than a location and is
 * therefore the guess. Neither is stored. Reading the units in the browser
 * instead would make the first paint disagree with the second (LESSONS §3a),
 * and the rider's *position* never comes near this file: "Near me" is asked
 * for, and answered, entirely in the component, and no coordinate of theirs is
 * sent anywhere (plan §6.4 standard 10).
 */
export default async function EventsPage() {
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
  });

  return <EventsScreen view={view} units={unitsForCountry(region)} signedIn={Boolean(session)} />;
}
