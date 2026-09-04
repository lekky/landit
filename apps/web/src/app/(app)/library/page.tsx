import type { PlanId, StageId } from '@landit/core';
import {
  listTrickPrereqs,
  listTrickProgress,
  listTricks,
  trickProgressById,
  tricksFromRecords,
} from '@landit/db';
import type { Metadata } from 'next';

import { ROUTES } from '@/lib/routes';
import { anonymousClient, currentRider } from '@/lib/session';

import { LibraryBrowser } from './LibraryBrowser';

export const metadata: Metadata = {
  title: 'Trick library · Land The Trick',
  description: 'Every trick Land The Trick tracks, with what you can already do marked off.',
  alternates: { canonical: ROUTES.library },
};

/**
 * The trick library (plan §7, T7; screenshot 08).
 *
 * **Readable signed out.** The library is the product's shop window and there
 * is nothing private in it — `tricks` and `trick_prereqs` are listable without
 * a token by their own API rules, and `@landit/db` says as much where it builds
 * the anonymous client. A visitor sees the same grid a rookie does, with the
 * paid tiers drawn as locked and nothing of theirs to mark off.
 *
 * **The tricks come from the database, not from `@landit/core`.** The canonical
 * data seeds the collection; the collection is what staff edit (plan §7, T17),
 * so reading the constants here would mean a staff edit that changes nothing a
 * rider can see. What comes from `core` is the *rules* applied to those rows.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await currentRider();
  const client = session?.client ?? anonymousClient();

  // `?mine=1` is read here rather than with `useSearchParams` in the browser,
  // so the first paint already knows which view it is. Reading it client-side
  // would render the full library, then swap to the rider's own tricks a frame
  // later — a flash of the wrong list on the screen most likely to be opened
  // from a bookmark (LESSONS §3a on server/client agreement).
  const mine = (await searchParams).mine === '1';

  const [trickRecords, prereqRecords] = await Promise.all([
    listTricks(client),
    listTrickPrereqs(client),
  ]);
  const tricks = tricksFromRecords(trickRecords, prereqRecords);

  let byId: Record<string, StageId> = {};
  if (session) {
    const progress = await listTrickProgress(client, session.rider.id);
    byId = trickProgressById(progress, trickRecords);
  }

  return (
    <LibraryBrowser
      tricks={tricks}
      byId={byId}
      plan={(session?.rider.plan ?? 'rookie') as PlanId}
      signedIn={!!session}
      initialMine={mine && !!session}
    />
  );
}
