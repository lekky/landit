import {
  DEFAULT_TIMEZONE,
  regionFromAcceptLanguage,
  sportsOf,
  unitsForCountry,
  type SportId,
} from '@landit/core';
import { eventsFromRecords, listEventAttendance, listEvents } from '@landit/db';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { EventsScreen } from './EventsScreen';
import { buildEventsView } from './view';

export const metadata: Metadata = {
  title: 'Events · Land The Trick',
  description: 'Comps, coached sessions, classes and jams that staff have put on the calendar.',
};

/**
 * Events (`landit-screens-d.jsx`, screenshot 18).
 *
 * Read with the rider's own client. `events` is public to any signed-in rider
 * and `event_attendance` is `OWN`, so "who else is going" is not readable and
 * is not shown — this product has no stranger-contact surface (plan §6.1), and
 * an attendee list would be one.
 *
 * **Distances are in the reader's units, resolved here, on the server** — the
 * same way `/spots` resolves them, off the rider's own country and falling back
 * to `Accept-Language`. Reading the units in the browser instead would make the
 * first paint disagree with the second (LESSONS §3a), and the rider's *position*
 * never comes near this file: "Near me" is asked for, and answered, entirely in
 * the component, and no coordinate of theirs is sent anywhere (plan §6.4
 * standard 10).
 */
export default async function EventsPage() {
  const session = await currentRider();
  if (!session) redirect(ROUTES.signIn);
  if (!session.rider.onboarded) redirect(ROUTES.onboarding);

  const { client, rider } = session;

  const [eventRecords, attendance] = await Promise.all([
    listEvents(client),
    listEventAttendance(client, rider.id),
  ]);

  // Attendance relates to the event *record*; everything else here keys by
  // slug, so the two are joined once, in the one place that knows both.
  const slugOf = new Map(eventRecords.map((e) => [e.id, e.slug]));
  const going = new Set<string>();
  for (const row of attendance) {
    const slug = slugOf.get(row.event);
    if (slug) going.add(slug);
  }

  const units = unitsForCountry(
    rider.country || regionFromAcceptLanguage((await headers()).get('accept-language')),
  );

  const view = buildEventsView({
    events: eventsFromRecords(eventRecords),
    sports: sportsOf({ sports: rider.sports as SportId[] }),
    going,
    clock: { timezone: rider.timezone || DEFAULT_TIMEZONE },
  });

  return <EventsScreen view={view} units={units} />;
}
