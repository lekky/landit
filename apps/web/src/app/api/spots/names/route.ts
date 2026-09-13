import { spotsSnapshot } from '@/lib/spotPoints';
import { snapshotResponse, spotTag } from '@/lib/spotsSnapshotResponse';

/**
 * `GET /api/spots/names` — the name and town of every live spot, in the order
 * `./points` listed them.
 *
 * The second half, fetched only once something actually needs the words: a
 * search a rider has typed, or the map drawing its own pins. A rider who
 * presses "Near me" on a phone and reads the list never asks for this at all.
 *
 * It carries the same `version` as the points it describes, and the screen
 * refuses to pair the two unless they match — see `lib/spotPoints.ts` for why
 * there is no id here to match on instead.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const snapshot = await spotsSnapshot();
  // `spotTag` is what keeps this distinct from the points' tag for the same
  // snapshot: two different bodies sharing one entity tag is the one thing a
  // cache is entitled to get wrong.
  return snapshotResponse(request, snapshot.namesJson, spotTag('names', snapshot.version));
}
