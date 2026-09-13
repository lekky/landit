import { listSpotPoints } from '@landit/db';
import { createHash } from 'node:crypto';

import { anonymousClient } from '@/lib/session';
import { staleWhileRevalidate } from '@/lib/staleCache';
import {
  toNameTuple,
  toPointTuple,
  type SpotNamesBody,
  type SpotPointsBody,
} from '@/lib/spotsWire';

/**
 * Every live spot, held once per process and served as the two halves the
 * spots screen actually waits on (issue #393's option 2; the owner,
 * 2026-09-12, in chat).
 *
 * ## Why this is two payloads and not one
 *
 * `/spots` cannot sort by distance without every live spot's coordinates, and
 * since the world import that is about thirty thousand rows. Sent as one list
 * it measured **2.80 MB of JSON, 886 KB gzipped** — two to five seconds on a
 * phone's connection before the list has moved at all, which is most of "Spots
 * takes way too long to update the results".
 *
 * Roughly half of those bytes are names and towns, and **nothing the list is
 * waiting for needs them**. Sorting needs the point; narrowing by sport needs
 * the bitmask; narrowing by feature needs the tags, which are 15 KB for the
 * lot. Names and towns are needed by exactly two things, and both can come
 * second: matching a search a rider has typed, and labelling the map's pins.
 *
 * So the list's half goes first and the reader's half follows:
 *
 * | | gzipped |
 * |---|---|
 * | `points` — `[id, lat, lng, sports, tags]` | **437 KB** |
 * | `names` — `[name, town]` | 372 KB |
 * | *(what one combined payload cost)* | *886 KB* |
 *
 * A rider who presses "Near me" on a phone and never opens the map or the
 * search box now downloads the first row and nothing else.
 *
 * ## What keeps the two halves talking about the same spots
 *
 * `names[i]` describes `points[i]` — there is no id in the names half, because
 * putting one there would add back most of what the split saves (ids are
 * fifteen random characters apiece and compress to almost nothing). That makes
 * alignment a real risk: the snapshot refreshes every few minutes, and a rider
 * who fetched `points` from one snapshot and `names` from the next would get a
 * list of spots labelled with their neighbours' names.
 *
 * **`version` is what stops it.** Both halves are built from one read and
 * stamped with the same string, and `mergePoints` refuses to pair them unless
 * it matches. It is a hash of the content rather than the time of the read, so
 * a refresh that finds nothing has changed — the common case — produces the
 * same version and the same `ETag`, and a browser that already has the bytes
 * gets a 304 instead of another 437 KB.
 *
 * ## Why this may be cached publicly
 *
 * Both halves are read with `anonymousClient()` against a `status = 'live'`
 * filter, so what comes back is the same for a rider, for staff and for a
 * stranger: a spot is a public place, and a rider's own pending submission was
 * never in this list to begin with (it reaches them through `spotsCardsAction`,
 * under the collection's own rule). There is nothing here that belongs to
 * whoever asked, which is what makes `Cache-Control: public` on the two routes
 * correct rather than a leak.
 *
 * ## Stale, deliberately
 *
 * `staleWhileRevalidate` serves the copy in memory at once and refreshes
 * behind the caller, so only the first request after a deploy ever waits on
 * PocketBase's four and a half seconds of work. A newly approved spot or a
 * staff edit reaches the map up to five minutes late — the trade the owner
 * accepted on #393 — and the browser cache above adds its own five on top of
 * that for a rider who does not reload.
 */

/** How long a snapshot is served from memory before a refresh starts behind it. */
const SNAPSHOT_TTL_MS = 5 * 60_000;

/**
 * Both halves, serialised once per read rather than once per request.
 *
 * A route handler that called `JSON.stringify` on thirty thousand rows for
 * every visitor would have moved the cost from PocketBase into this process
 * instead of removing it. The strings are what the cache holds and what the
 * routes hand straight to `Response`.
 */
export interface SpotsSnapshot {
  readonly version: string;
  readonly pointsJson: string;
  readonly namesJson: string;
}

async function readSnapshot(): Promise<SpotsSnapshot> {
  const rows = await listSpotPoints(anonymousClient());
  const points = rows.map(toPointTuple);
  const names = rows.map(toNameTuple);

  /*
   * Short, and not a cryptographic claim about anything — it is a cache key
   * over our own public data, so its only job is to differ when the spots
   * differ. Taken over the points alone so that the result can then be
   * embedded inside both bodies.
   */
  const version = createHash('sha1').update(JSON.stringify(points)).digest('hex').slice(0, 16);

  return {
    version,
    pointsJson: JSON.stringify({ version, points } satisfies SpotPointsBody),
    namesJson: JSON.stringify({ version, names } satisfies SpotNamesBody),
  };
}

const snapshot = staleWhileRevalidate(readSnapshot, { ttlMs: SNAPSHOT_TTL_MS });

/** The current snapshot: from memory, or read now if this process has none yet. */
export function spotsSnapshot(): Promise<SpotsSnapshot> {
  return snapshot.get();
}

/** Forget it, so the next request reads afresh. */
export function forgetSpotsSnapshot(): void {
  snapshot.clear();
}
