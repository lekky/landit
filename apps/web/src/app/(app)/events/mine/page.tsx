import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ROUTES, signInHref } from '@/lib/routes';
import { currentRider } from '@/lib/session';

import { EventsScreen } from '../EventsScreen';
import { loadEvents } from '../load';

export const metadata: Metadata = {
  title: 'Your events · Land The Trick',
  /*
   * `noindex`, and it is not a judgement call. This page is one rider's
   * attendance; there is nothing here for a crawler to index and a URL that
   * answers a bot with a redirect to `/signin` teaches a search engine that
   * this site's sitemap cannot be trusted. `GATED_ROUTES` says the same thing
   * to `robots.txt`, and `publicRoutes.test.ts` fails if the two ever disagree.
   */
  robots: { index: false, follow: false },
};

/**
 * A rider's own events — what they are down for, and what they have been to
 * (Rachid, 2026-09-13, in chat).
 *
 * **Why it is a third tab and not a filter.** "I'm going" was write-only: a
 * rider could mark an event and the only thing the product ever said back was a
 * counter at the foot of the calendar. The thing they actually want to ask is
 * "what am I doing next, and what have I been to" — and that is one question
 * with two tenses, not a narrowing of either half. It sits in the same
 * segmented control as Upcoming and Past because that is where a rider is
 * already looking when they want it.
 *
 * **It is not a third opinion about what "past" means.** The list is
 * `myEvents`, which is cut from `upcomingEvents` and `pastEvents` — the same
 * pair `/events` and `/events/past` are cut from — so a rider's own tab cannot
 * tell them an event is coming up while the calendar calls it over. That is the
 * bug the design handoff records, and the reason every events view in this
 * product goes through one split in `@landit/core`.
 *
 * **The one gated tab of the three.** `/events` and `/events/past` are public
 * because a live event is public data; this is one rider's attendance, which
 * `event_attendance`'s `OWN` rule makes readable to nobody else — so a
 * signed-out visitor is sent to sign in and brought back here rather than shown
 * an empty list that looks like a product with nothing in it. Nobody else's
 * attendance is on this screen or reachable from it (plan §6.1).
 *
 * **No onboarding bounce**, on the same grounds as `/events`: marking yourself
 * down for a jam is not a thing onboarding settles, and a rider mid-signup who
 * already has attendance should be able to read it.
 */
export const dynamic = 'force-dynamic';

export default async function MyEventsPage() {
  /*
   * Read once, here, rather than leaving `loadEvents` to discover it: the
   * redirect has to happen before any work, and `loadEvents` answering a
   * visitor with an empty list would render "you haven't marked anything yet"
   * at somebody who simply is not signed in.
   */
  const session = await currentRider();
  if (!session) redirect(signInHref(ROUTES.eventsMine));

  const { view, units, signedIn } = await loadEvents('mine');
  return <EventsScreen view={view} units={units} signedIn={signedIn} />;
}
