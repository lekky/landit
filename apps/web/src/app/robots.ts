import { SITE_URL } from '@landit/core';
import type { MetadataRoute } from 'next';

import { isLiveFromEnv } from '@/lib/siteLive';

/**
 * `robots.txt`, which until now did not exist at all — so `landthetrick.com`
 * was serving a half-built product to crawlers with nothing telling them to stay
 * away. A bad first index is slow and annoying to undo, and it is the part of
 * "the site is public too early" that a holding page alone does not fix: the
 * rewrite stops a **person** seeing the app, but a page Google indexed last week
 * is already in the results.
 *
 * Two states, from the same flag the proxy reads (`@/lib/siteLive`):
 *
 * - **Gate shut** — disallow everything. The holding page carries `noindex` of
 *   its own as well, because `robots.txt` asks a crawler not to *fetch* a page
 *   and a `noindex` tag tells it not to *list* one, and a URL that is only
 *   disallowed can still turn up in results on the strength of inbound links.
 * - **Gate open** — allow everything, and say where the sitemap is.
 *
 * The sitemap line is the half that was missing. `robots.txt` is the first file
 * a crawler asks for and the only one it is guaranteed to look at, so a sitemap
 * nothing points at is a sitemap most crawlers never fetch. It is only offered
 * once the gate is open, because behind the gate everything is disallowed and
 * `sitemap.ts` answers empty — advertising it there would be the two files
 * contradicting each other.
 */

/*
 * A robots route is cached — effectively baked at build — unless it is told
 * otherwise, and this one answers a question whose answer changes at runtime
 * without a rebuild. Without this the file would be frozen to whatever the flag
 * said inside `docker build`, which is the same build-time-inlining trap that
 * `NEXT_PUBLIC_*` sprang on this project once already (LESSONS §6).
 */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (!isLiveFromEnv()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
