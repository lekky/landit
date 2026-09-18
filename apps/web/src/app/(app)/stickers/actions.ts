'use server';

import { markStickerWallSeen } from '@landit/db';
import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/lib/routes';
import { currentRider } from '@/lib/session';
import { acknowledgeStickers } from '@/lib/stickers';

/**
 * Mark stickers announced, after the screen has shown them.
 *
 * Deliberately a second round trip rather than a side effect of reading them:
 * a sticker stamped `seen_at` on the way out is a sticker a dropped response
 * silently swallows, and the whole point of `seen_at` is that a rider hears
 * about an achievement exactly once — not at most once (plan §3).
 *
 * It runs with the rider's own client, which is what makes it a proof as well
 * as a write: `seen_at` is the entire write access `rider_stickers` grants a
 * rider, and the hook rejects an update that moves anything else.
 */
export async function acknowledgeStickersAction(ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  const session = await currentRider();
  if (!session) return;
  await acknowledgeStickers(session.client, ids);
}

/**
 * Stamp that the rider has been to their wall (2026-09-18).
 *
 * What the library's sticker shelf reads: its "N new" flag is the awards
 * earned after this moment, so opening the wall is what clears it. Called once
 * on arrival, beside — but not inside — the acknowledge effect, because the two
 * answer different questions. Acknowledging says "this award has been shown";
 * this says "the rider has been to look", and a visit to a wall with nothing
 * new on it still counts as a visit.
 *
 * Fails soft. A missed stamp leaves the flag up for one more visit, which is a
 * great deal better than a screen that will not load because a bookmark could
 * not be written.
 */
export async function markStickerWallSeenAction(): Promise<void> {
  const session = await currentRider();
  if (!session) return;
  try {
    await markStickerWallSeen(session.client, session.rider.id);
    /*
     * The library is where the flag is drawn, and it is rendered on the server.
     * Both screens are dynamic — every render resolves the session — so there is
     * no data cache to bust here; what this clears is the client router cache,
     * so a rider who walks back to the tricks page with the back button does not
     * meet the flag they have just cleared.
     */
    revalidatePath(ROUTES.library);
  } catch {
    // See above: a flag that clears one visit late is not worth an error.
  }
}
