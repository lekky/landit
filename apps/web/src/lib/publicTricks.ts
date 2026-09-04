import { listTricks, type TricksRecord } from '@landit/db';

import { anonymousClient } from '@/lib/session';

/**
 * Every live trick, for the two files that describe the site to a machine —
 * `app/sitemap.ts` and `app/llms.txt/route.ts`.
 *
 * **It never throws.** Both callers are fetched by robots rather than by
 * people, and a crawler that asks for a sitemap and gets a 500 does not shrug
 * and try the pages anyway: it records that the site is broken and comes back
 * later. Answering with the pages that need no database is strictly better than
 * answering with nothing, so a database that is down costs the trick list and
 * nothing else.
 *
 * **The `try` has to wrap the client, not just the query.** `anonymousClient()`
 * throws synchronously when `POCKETBASE_URL` is unset, which is *before* there
 * is a promise for a `.catch` to attach to — so the obvious
 * `listTricks(anonymousClient()).catch(...)` does not catch it, and both routes
 * answered 500 on a checkout with no `.env.local`. That is the shape of thing a
 * PR preview and a half-configured box both look like.
 *
 * `listTricks` already filters to `is_live`, so a trick staff have hidden is
 * never advertised.
 */
export async function publicTricks(): Promise<TricksRecord[]> {
  try {
    return await listTricks(anonymousClient());
  } catch {
    return [];
  }
}
