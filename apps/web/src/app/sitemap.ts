import { SITE_URL } from '@landit/core';
import type { MetadataRoute } from 'next';

import { PUBLIC_ROUTES } from '@/lib/publicRoutes';
import { ROUTES, eventHref, spotHref, trickHref } from '@/lib/routes';
import { isLiveFromEnv } from '@/lib/siteLive';
import { publicEvents } from '@/lib/publicEvents';
import { publicSpots } from '@/lib/publicSpots';
import { publicTricks } from '@/lib/publicTricks';

/**
 * `sitemap.xml`, which did not exist — and without which the trick library was
 * undiscoverable.
 *
 * The library grid navigated with `router.push` on a `<button>`, so there was
 * no crawlable link into `/library/[slug]` from anywhere on the site. The trick
 * pages cross-link *each other* through the unlock graph, so the corpus is
 * connected; nothing linked *into* it. A crawler reached `/library`, found a
 * grid of buttons, and left. The companion fix makes those cards anchors
 * (`packages/ui-web/src/components/tricks.tsx`); this file is the belt to that
 * pair of braces, and the thing that tells a crawler a page has *changed*.
 *
 * **Only what is genuinely public goes in.** A sitemap is a claim that a URL is
 * worth indexing, so a URL that answers a signed-out visitor with a redirect to
 * `/signin` has no business here — `/home`, `/progress`, `/stickers`,
 * `/challenge`, `/crew`, `/account`. Nor does anything already carrying
 * `robots: { index: false }`: the admin screens, `/coach`, rider profiles,
 * `/join/[code]`, the consent pages, `/design`. What is left is the marketing
 * page, the library and its tricks, spots, events, plans, the reporting route
 * and the legal documents.
 *
 * `/signin` and `/signup` are deliberately absent too. They are reachable and
 * not forbidden — nothing here changes that — but a sitemap is for pages worth
 * *arriving* on, and neither says anything a search result should carry.
 */

/*
 * Same reasoning as `robots.ts`: a sitemap route is cached unless told
 * otherwise, and this one reads the trick collection at request time. Baking it
 * would freeze the trick list to whatever the database held during `docker
 * build` — which, on a box where the build has no database at all, is nothing.
 * A sitemap is fetched a handful of times a day; a query per fetch is free.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /*
   * Behind the gate, `robots.ts` disallows everything. A sitemap advertising
   * URLs at the same time would be the two files disagreeing, so this one is
   * empty until the site is live — the same flag, read the same way.
   */
  if (!isLiveFromEnv()) return [];

  const url = (path: string) => `${SITE_URL}${path}`;
  const now = new Date();

  /*
   * `PUBLIC_ROUTES` is the list, and its test is what stops a gated route
   * creeping in (`lib/publicRoutes.ts`). Priority is the only thing decided
   * here, because it is a statement about *this* file rather than about which
   * pages are public: the library and the tricks are what this site is for.
   */
  const priority = (path: string): number => {
    if (path === ROUTES.home) return 1;
    if (path === ROUTES.library) return 0.9;
    if (path.startsWith('/legal/')) return 0.3;
    if (path === ROUTES.report) return 0.4;
    return 0.7;
  };

  const fixed: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((path) => ({
    url: url(path),
    lastModified: now,
    changeFrequency: path === ROUTES.events ? ('daily' as const) : ('weekly' as const),
    priority: priority(path),
  }));

  /*
   * The tricks come from the database rather than from `@landit/core`, for the
   * reason the library page gives: the canonical data seeds the collection, and
   * the collection is what staff edit. `listTricks` already filters to
   * `is_live`, so a trick staff have hidden is not advertised.
   *
   * **A sitemap that cannot reach the database is a smaller sitemap, not a
   * 500.** Same rule the trick page reads its award badge under: this file is
   * fetched by robots, and answering a crawler with a server error over a
   * database blip is a worse outcome than answering with the pages that do not
   * need one. `publicTricks` is where that promise is kept — and it has to
   * cover building the client as well as querying with it, because
   * `anonymousClient()` throws for a missing `POCKETBASE_URL` **before** there
   * is a promise to attach a `.catch` to. That is not hypothetical: it is what
   * this route did on first run.
   */
  /*
   * The tricks and the events, read under the same promise and in one round
   * trip. `publicEvents` keeps the "a sitemap that cannot reach the database is
   * a smaller sitemap, not a 500" rule above; `Promise.all` over two never-
   * throwing reads cannot reintroduce a rejection.
   */
  const [tricks, events] = await Promise.all([publicTricks(), publicEvents()]);

  /*
   * The spots, on the same terms as the tricks — from the database, live rows
   * only, and never at the cost of the whole file (`publicSpots`).
   *
   * **Only spots staff have approved**, which is the same rule the page itself
   * keeps (Rachid, 2026-09-06, in chat: pages exist for spots confirmed by us).
   * A rider's pending submission still shows on `/spots` exactly as it did, to
   * that rider; it has no page, so it has no business in a file whose entire
   * content is a claim that these URLs are worth indexing.
   *
   * A spot with no slug is skipped rather than linked to `/spots/`. Every row
   * gets one on the way in (`pocketbase/hooks/63_spot_slugs.pb.js`) and the
   * migration filled the rest, so this guards a database that is mid-deploy
   * rather than a case anybody expects.
   */
  const spots = await publicSpots();

  return [
    ...fixed,
    ...tricks.map((trick) => ({
      url: url(trickHref(trick.slug)),
      lastModified: trick.updated ? new Date(trick.updated) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    /*
     * Every live event, **past ones included** (Rachid, 2026-09-06, in chat).
     * A finished event keeps its page — it is the archive, and riders keep
     * looking these up — so dropping it from the sitemap the morning after
     * would pull a page out of the index exactly when it starts earning its
     * traffic. `publicEvents` says the same thing at more length.
     *
     * `weekly` rather than the list's `daily`: the calendar as a whole changes
     * daily because staff add rows, but a single listing changes only when
     * somebody edits it, and `lastModified` is the honest signal for that.
     */
    ...events.map((event) => ({
      url: url(eventHref(event.slug)),
      lastModified: event.updated ? new Date(event.updated) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...spots
      .filter((spot) => spot.slug)
      .map((spot) => ({
        url: url(spotHref(spot.slug)),
        lastModified: spot.updated ? new Date(spot.updated) : now,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })),
  ];
}
