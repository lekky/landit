import type { Route } from 'next';

import { LEGAL_DOC_IDS } from '@/content/legal';
import { ROUTES, legalHref } from '@/lib/routes';

/**
 * The pages a signed-out visitor can actually read, and the only ones the
 * sitemap is allowed to advertise.
 *
 * **This is a list, not a filter, deliberately.** Whether a screen reads signed
 * out is a decision each page makes in its own body — some redirect, some load
 * an anonymous client, `/report` is public because the OSA codes require it —
 * and there is no property to read that answers it. So the answer is written
 * down once, here, next to a test that fails if a gated route creeps in.
 *
 * A sitemap is a claim that a URL is worth indexing. Listing one that answers a
 * crawler with a redirect to `/signin` wastes the crawl and teaches a search
 * engine that this site's sitemap cannot be trusted, which is a slow thing to
 * undo. So the cost of getting this wrong is not "one bad row".
 *
 * `/signin` and `/signup` are absent on purpose. They are public and nothing
 * here forbids them; they are simply not pages worth *arriving* on from a
 * search result. `/offline` and the `/design` gallery carry `noindex` of their
 * own and are not public in any useful sense.
 */

/** The signed-out routes, in the order a sitemap should list them. */
export const PUBLIC_ROUTES: readonly Route[] = [
  ROUTES.home,
  ROUTES.library,
  ROUTES.spots,
  ROUTES.events,
  ROUTES.plans,
  ROUTES.report,
  ...LEGAL_DOC_IDS.map((id) => legalHref(id)),
];

/**
 * The routes that answer a signed-out visitor with a redirect, or that carry
 * `robots: { index: false }`.
 *
 * Only here so the test has something to check `PUBLIC_ROUTES` against — a
 * second list that has to disagree with the first. Keeping it means the day
 * somebody makes `/progress` public, two files have to say so.
 */
export const GATED_ROUTES: readonly Route[] = [
  ROUTES.dashboard,
  ROUTES.progress,
  ROUTES.stickers,
  ROUTES.challenge,
  ROUTES.crew,
  ROUTES.coach,
  ROUTES.account,
  ROUTES.onboarding,
];
