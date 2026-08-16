'use server';

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
