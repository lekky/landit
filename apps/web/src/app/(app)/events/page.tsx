import { DEFAULT_TIMEZONE, sportsOf, type SportId } from '@landit/core';
import { eventsFromRecords, listEventAttendance, listEvents } from '@landit/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { EventsScreen } from './EventsScreen';
import { buildEventsView } from './view';

export const metadata: Metadata = {
  title: 'Events · Land It',
  description: 'Comps, coached sessions, classes and jams that staff have put on the calendar.',
};

/**
 * Events (`landit-screens-d.jsx`, screenshot 18).
 *
 * Read with the rider's own client. `events` is public to any signed-in rider
 * and `event_attendance` is `OWN`, so "who else is going" is not readable and
 * is not shown — this product has no stranger-contact surface (plan §6.1), and
 * an attendee list would be one.
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

  const view = buildEventsView({
    events: eventsFromRecords(eventRecords),
    sports: sportsOf({ sports: rider.sports as SportId[] }),
    going,
    clock: { timezone: rider.timezone || DEFAULT_TIMEZONE },
  });

  return <EventsScreen view={view} />;
}
