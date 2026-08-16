import { listStickers, listUnseenRiderStickers, markStickerSeen, type Client } from '@landit/db';

/**
 * Announcing a sticker exactly once.
 *
 * The award itself is not here and cannot be: `rider_stickers` has
 * `createRule: null`, so the PocketBase hook on `trick_progress` (and on
 * `clips`, `challenge_log` and `crew_members`) is the only writer, evaluating
 * the rules against stats it recomputes from the database (plan §3). By the
 * time a server action returns, the row either exists or the rider did not earn
 * it — nothing in the browser gets a vote.
 *
 * What *is* here is the announcement, and the shape is announce-then-
 * acknowledge rather than announce-and-forget:
 *
 * 1. `unseenStickers` reads the rows with an empty `seen_at`;
 * 2. the screen shows them — a toast on the trick page, the `just` pop on the
 *    wall;
 * 3. the screen calls back and `acknowledgeStickers` stamps `seen_at`.
 *
 * The second step is the one that makes "never re-announced" true rather than
 * stated. Stamping `seen_at` at the same moment the row is read would mark a
 * sticker announced to a rider whose browser dropped the response, and they
 * would never hear about it — for an achievement, that is the wrong way to
 * fail.
 */

/** One sticker, ready for a toast or a badge. */
export interface StickerToast {
  /** The `rider_stickers` row id. This is what `acknowledgeStickers` stamps. */
  readonly id: string;
  /** The sticker's slug — the canonical id, stable across a reseed. */
  readonly slug: string;
  readonly name: string;
  readonly hue: string;
  readonly icon?: string;
}

/**
 * The stickers this rider has earned and never been shown, oldest first.
 *
 * Fails soft: a rider who just landed a trick should see their stage saved even
 * if the sticker read falls over. A missed announcement is recoverable — the
 * row keeps its empty `seen_at` and the next screen picks it up.
 */
export async function unseenStickers(client: Client, userId: string): Promise<StickerToast[]> {
  try {
    const [rows, stickers] = await Promise.all([
      listUnseenRiderStickers(client, userId),
      listStickers(client),
    ]);
    const byId = new Map(stickers.map((s) => [s.id, s]));

    const out: StickerToast[] = [];
    for (const row of rows) {
      const sticker = byId.get(row.sticker);
      // A sticker staff have retired mid-flight has no live record. It stays
      // unseen rather than being announced under a name nobody can look up.
      if (!sticker) continue;
      out.push({
        id: row.id,
        slug: sticker.slug,
        name: sticker.name,
        hue: sticker.hue,
        ...(sticker.ico ? { icon: sticker.ico } : {}),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Stamp `seen_at` on rows the rider has now been shown.
 *
 * The rider's own client, deliberately: setting `seen_at` is the entire write
 * access `rider_stickers` grants them, and `30_stickers.pb.js` rejects an
 * update that moves anything else. Running this with the superuser client would
 * work and would prove nothing about the rule.
 */
export async function acknowledgeStickers(
  client: Client,
  riderStickerIds: readonly string[],
): Promise<void> {
  await Promise.all(
    riderStickerIds.map(async (id) => {
      try {
        await markStickerSeen(client, id);
      } catch {
        // Acknowledging is best-effort. The worst case is one repeated toast,
        // which is a great deal better than a swallowed one.
      }
    }),
  );
}
