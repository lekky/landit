import { listLiveSpots, type SpotsRecord } from '@landit/db';

import { anonymousClient } from '@/lib/session';

/**
 * Every approved spot, for `app/sitemap.ts`.
 *
 * The same promise `publicTricks` makes, for the same reason and with the same
 * shape: **it never throws.** The sitemap is fetched by robots rather than by
 * people, and a crawler answered with a 500 does not shrug and try the pages
 * anyway — it records that the site is broken and comes back later. A database
 * that is down should cost the spot list and nothing else.
 *
 * The `try` wraps the client as well as the query, which is the part that is
 * easy to get wrong: `anonymousClient()` throws synchronously when
 * `POCKETBASE_URL` is unset, *before* there is a promise for a `.catch` to
 * attach to. `publicTricks.ts` has the longer version of that note.
 *
 * `listLiveSpots` filters to `status = 'live'`, so a rider's unreviewed
 * submission is never advertised — it has no page either (`getSpotBySlug`).
 */
export async function publicSpots(): Promise<SpotsRecord[]> {
  try {
    return await listLiveSpots(anonymousClient());
  } catch {
    return [];
  }
}
