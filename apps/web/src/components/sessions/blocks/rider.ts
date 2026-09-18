import { listSessionsForTrickForOwner, getSpotsByIds, type Client } from '@landit/db';
import { cache } from 'react';

import { currentRider, type RiderSession } from '@/lib/session';
import { sessionsEnabledFor } from '@/lib/sessionsPreview';

/**
 * Who the blocks are for.
 *
 * A host page that already holds the rider passes it (`session={session}`),
 * which costs nothing. A page that does not passes nothing, and the block asks
 * once itself. **A signed-out visitor costs no read either way**: `null` is
 * passed straight through, and `currentRider` returns before any request when
 * there is no cookie.
 *
 * **Owner-only preview (T41):** nobody but the rider `sessionsEnabledFor`
 * names, so all three blocks render nothing — and read nothing — for everyone
 * else.
 */
export async function riderFor(
  session: RiderSession | null | undefined,
): Promise<RiderSession | null> {
  const viewer = session !== undefined ? session : await currentRider();
  return viewer && sessionsEnabledFor(viewer.rider) ? viewer : null;
}

/**
 * A rider's own sessions on one trick, read **once per request** (T49).
 *
 * `TrickSessionsBlock` draws them; since the app shell rethink the trick page
 * also needs to know *how many* before it draws anything, because the block is
 * inside a disclosure row whose sub-line is the count and which must not exist
 * at all when there are none. Two callers, one read: `cache` keys on the
 * arguments, and both pass the same client instance — the page hands the block
 * its own `session`, so `riderFor` gives back the very object the page holds.
 *
 * Never throws. A diary that will not load is a page without the block, the way
 * the block's own `catch` already had it, rather than a page that 500s.
 */
export const trickSessionsForOwner = cache(
  async (client: Client, userId: string, trickId: string) =>
    listSessionsForTrickForOwner(client, { userId, trickId }).catch(() => []),
);

/** Spot names by id, for rows that name where a session was. Never throws. */
export async function spotNames(
  client: Client,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (!wanted.length) return new Map();
  const rows = await getSpotsByIds(client, wanted).catch(() => []);
  return new Map(rows.map((row) => [row.id, row.name]));
}
