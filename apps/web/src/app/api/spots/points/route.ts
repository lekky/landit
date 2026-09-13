import { spotsSnapshot } from '@/lib/spotPoints';
import { snapshotResponse, spotTag } from '@/lib/spotsSnapshotResponse';

/**
 * `GET /api/spots/points` — every live spot's id, point, sports and tags.
 *
 * The half of the spot list `/spots` waits on before it can sort by distance.
 * See `lib/spotPoints.ts` for why it is a half, what the other one holds, and
 * why data this public may be cached where everyone can see it.
 *
 * **A route rather than the Server Function it replaced.** `spotsPointsAction`
 * was a POST, which no browser and no proxy will ever cache, so every visit to
 * `/spots` downloaded the whole list again from cold — the same bytes, for the
 * same spots, to the same rider, every time. A `GET` with an `ETag` is the same
 * data over a mechanism that already knows how to not send it twice.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const snapshot = await spotsSnapshot();
  return snapshotResponse(request, snapshot.pointsJson, spotTag('points', snapshot.version));
}
