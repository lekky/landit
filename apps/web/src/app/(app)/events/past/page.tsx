import type { Metadata } from 'next';

import { ROUTES } from '@/lib/routes';

import { EventsScreen } from '../EventsScreen';
import { loadEvents } from '../load';

export const metadata: Metadata = {
  title: 'Past events · Land The Trick',
  description:
    'Comps, jams, classes and sessions that have already happened. Kept online because riders still look them up.',
  alternates: { canonical: ROUTES.eventsPast },
};

/**
 * The archive — every event that has already happened (design handoff,
 * "Screen 3 — Events list", the past view).
 *
 * **Why it is a route and not a filter.** It used to be a pill on `/events`,
 * which meant the archive had no address: nothing to share, nothing to crawl,
 * and no way for a rider searching for what happened at their park last summer
 * to arrive anywhere but the front of the calendar. Past event pages are
 * indexed and stay indexed (`publicEvents`, `sitemap.ts`); this is the door
 * into them.
 *
 * **It cannot show an upcoming event, and `/events` cannot show a finished
 * one.** Both halves are cut once, in `@landit/core` — `upcomingEvents` and
 * `pastEvents` are each other's exact complement, and the property is asserted
 * rather than assumed (`packages/core/src/rules/events.test.ts`). The prototype
 * had them overlapping, which is the bug the handoff asks to be tested.
 *
 * **Indexed, deliberately.** The whole archive and every year-and-town corner
 * that holds events are real pages with real listings on them. The only thing
 * that carries `noindex` is a corner a reader typed by hand that turns out to
 * be empty — see `[year]/[town]/page.tsx`.
 */
export const dynamic = 'force-dynamic';

export default async function PastEventsPage() {
  const { view, units, signedIn } = await loadEvents('past');
  return <EventsScreen view={view} units={units} signedIn={signedIn} />;
}
