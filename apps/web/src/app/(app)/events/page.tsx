import type { Metadata } from 'next';

import { ROUTES } from '@/lib/routes';

import { EventsScreen } from './EventsScreen';
import { loadEvents } from './load';

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
 * **Upcoming only, and it cannot be otherwise.** This route used to carry a
 * pair of pills that let a finished event onto the calendar; the archive is now
 * `/events/past`, its own address, and the split is made once in
 * `@landit/core`. A view that cannot express "both" cannot mix the two, which
 * is the bug the design handoff records — proved as a property in
 * `packages/core/src/rules/events.test.ts` rather than left to two filters that
 * have to stay in step.
 *
 * **Distances are in the reader's units, resolved on the server** (`loadEvents`),
 * from two signals with the weaker consulted only when the stronger is
 * missing: a signed-in rider's declared country wins, and a visitor is read
 * from `Accept-Language`, which is a browser setting rather than a location and
 * is therefore the guess. Neither is stored. Reading the units in the browser
 * instead would make the first paint disagree with the second (LESSONS §3a),
 * and the rider's *position* never comes near this file: "Near me" is asked
 * for, and answered, entirely in the component, and no coordinate of theirs is
 * sent anywhere (plan §6.4 standard 10).
 */

/*
 * The Details modal's state is `?event=slug` (Rachid, 2026-09-06, in chat), so
 * this route is read with a query string. Nothing on the server reads it — the
 * modal opens in the browser from `useSearchParams`, which is what keeps it
 * instant — but a route with a search param that renders statically would be
 * frozen with somebody's parameter baked in.
 */
export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const { view, units, signedIn } = await loadEvents('upcoming');
  return <EventsScreen view={view} units={units} signedIn={signedIn} />;
}
