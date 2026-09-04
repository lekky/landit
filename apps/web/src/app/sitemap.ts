import { SITE_URL } from '@landit/core';
import type { MetadataRoute } from 'next';

import { PUBLIC_ROUTES } from '@/lib/publicRoutes';
import { ROUTES, trickHref } from '@/lib/routes';
import { isLiveFromEnv } from '@/lib/siteLive';
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
  const tricks = await publicTricks();

  return [
    ...fixed,
    ...tricks.map((trick) => ({
      url: url(trickHref(trick.slug)),
      lastModified: trick.updated ? new Date(trick.updated) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
