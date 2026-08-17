import { unitsForCountry, type SportId } from '@landit/core';
import { listSpots } from '@landit/db';
import type { Metadata } from 'next';

import { anonymousClient, currentRider } from '@/lib/session';

import { SpotsScreen, type SpotView } from './SpotsScreen';

export const metadata: Metadata = {
  title: 'Spots · Land The Trick',
  description: 'Parks, street spots and bowls riders have put on the map.',
};

/**
 * Where to ride (plan §7, T13; screenshot 19).
 *
 * **Readable signed out**, like the library: `spots` lists a `live` row to
 * anybody by its own API rule, and there is nothing private on this screen —
 * a spot is a public place. What signing in adds is the ability to put one
 * forward, and to see your own submissions while they wait.
 *
 * **The list is whatever the rules hand back, and nothing here filters for
 * safety.** `listSpots` returns live spots plus the caller's own pending ones,
 * because that is what the `listRule` says; a `pending` spot belonging to
 * somebody else is not omitted here, it is invisible (plan §6.1, proven over
 * HTTP in `pocketbase/tests/spot-submission.test.ts`). The split below is
 * presentation — which card gets the "waiting to be checked" treatment — never
 * a privacy boundary.
 *
 * **Distances are in the rider's units, resolved here.** `unitsForCountry`
 * reads the country given at sign-up; a signed-out visitor has none and gets
 * kilometres. It is settled on the server precisely because it must not be
 * locale-derived in the browser (LESSONS §5).
 */
export default async function SpotsPage() {
  const session = await currentRider();
  const client = session?.client ?? anonymousClient();
  const records = await listSpots(client);

  const spots: SpotView[] = records.map((record) => ({
    id: record.id,
    name: record.name,
    town: record.town,
    type: record.type,
    lat: record.lat,
    lng: record.lng,
    sports: (record.sports ?? []) as SportId[],
    tags: Array.isArray(record.tags) ? (record.tags as string[]) : [],
    status: record.status,
  }));

  return (
    <SpotsScreen
      spots={spots}
      signedIn={!!session}
      units={unitsForCountry(session?.rider.country)}
    />
  );
}
