import { getSpotsByIds, type Client } from '@landit/db';

import { currentRider, type RiderSession } from '@/lib/session';

/**
 * Who the blocks are for.
 *
 * A host page that already holds the rider passes it (`session={session}`),
 * which costs nothing. A page that does not passes nothing, and the block asks
 * once itself. **A signed-out visitor costs no read either way**: `null` is
 * passed straight through, and `currentRider` returns before any request when
 * there is no cookie.
 */
export async function riderFor(
  session: RiderSession | null | undefined,
): Promise<RiderSession | null> {
  if (session !== undefined) return session;
  return currentRider();
}

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
