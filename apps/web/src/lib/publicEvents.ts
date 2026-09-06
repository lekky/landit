import { listEvents, type EventsRecord } from '@landit/db';

import { anonymousClient } from '@/lib/session';

/**
 * Every live event, for `app/sitemap.ts`.
 *
 * `publicTricks`'s twin, and it exists for the same two reasons that file
 * spells out: **it never throws**, because the caller is fetched by robots and
 * a 500 teaches a crawler that this site is broken rather than that one list is
 * missing; and the `try` has to wrap `anonymousClient()` as well as the query,
 * because that constructor throws synchronously on a missing `POCKETBASE_URL`
 * — before there is a promise for a `.catch` to attach to.
 *
 * **Past events are included, and that is the decision, not an oversight**
 * (Rachid, 2026-09-06, in chat). A finished event keeps its page and keeps
 * pulling in traffic — riders look up what happened last summer — so a sitemap
 * that dropped it the morning after would be taking a page out of the index
 * precisely when it starts being the archive. `listEvents` filters to
 * `is_live`, so an event staff have *hidden* is a different thing entirely and
 * is never advertised.
 */
export async function publicEvents(): Promise<EventsRecord[]> {
  try {
    return await listEvents(anonymousClient());
  } catch {
    return [];
  }
}
