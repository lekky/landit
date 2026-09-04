import { SITE_URL, SPORT_IDS } from '@landit/core';
import { LEGAL_DOCS } from '@/content/legal';
import { ROUTES, legalHref, trickHref } from '@/lib/routes';
import { publicTricks } from '@/lib/publicTricks';
import { isLiveFromEnv } from '@/lib/siteLive';
import { lowerLabel, sportsList } from '@/lib/sports';

/**
 * `/llms.txt` — the site in plain text, for a model rather than a browser.
 *
 * **What it is for.** A crawler that renders pages gets Land The Trick as
 * ninety-odd screens of markup with a shell around each one. The convention
 * this file follows is a short, linked summary at a known path: what the
 * product is, which pages carry what, and where the source of each answer is.
 * It costs a model far less to read and leaves much less room for it to invent
 * something — which is the actual risk on a product used by children, where a
 * confident wrong summary of the safeguarding position is worse than no
 * summary at all.
 *
 * **It is a map, not a second copy of the site.** Everything here is a heading
 * and a link; the answers stay on the pages, which stay the single source. That
 * is deliberate — a paraphrase kept here would be the copy that goes stale, and
 * this file would then be actively misleading the readers least able to check.
 *
 * The convention is young and no crawler is obliged to fetch this. It is a few
 * hundred bytes and it costs one route.
 */

/*
 * Same reasoning as `robots.ts` and `sitemap.ts`: read at request time, because
 * it counts the trick library and reads the launch flag, and neither is known
 * inside `docker build`.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  /*
   * Behind the gate, `robots.txt` disallows everything and the sitemap is
   * empty. A guide to a site nobody is meant to be reading yet would be the
   * three files disagreeing.
   */
  if (!isLiveFromEnv()) {
    return new Response('', { status: 404 });
  }

  const url = (path: string) => `${SITE_URL}${path}`;
  // Degrades the same way the sitemap does, for the same reason: a map with no
  // examples in it beats a 500 served to whatever came to read the site.
  const tricks = await publicTricks();

  /*
   * Two examples per sport, not the whole library — the sitemap is the
   * exhaustive list and is linked below. This is here so a reader can see what
   * a trick page looks like without guessing a URL.
   */
  const examples = SPORT_IDS.flatMap((sport) => {
    const some = tricks.filter((t) => t.sport === sport).slice(0, 2);
    return some.map(
      (t) =>
        `- [${t.name}](${url(trickHref(t.slug))}): a ${lowerLabel(sport)} trick, with how to do it, what you need, and what it leads on to.`,
    );
  });

  const body = `# Land The Trick

> A trick tracker for ${sportsList()} riders. A rider logs the tricks they can
> do and how solid each one is, on an honesty-based five-stage scale, and the
> library shows them what that unlocks next.

Land The Trick is a subscription web app at ${SITE_URL}, run from the north of
England. The trick library is free to read without an account. Tracking your own
progress needs one; paid plans unlock the harder tricks to track, and nothing in
the product is a purchasable achievement — awards are earned by riding.

It is used by children, and is built to be: profiles are private by default,
clips are never public, there is no rider-to-rider messaging, no algorithmic
feed, and crews are invite-only with no way to search for strangers.

## The library

Ninety-odd tricks across ${sportsList()}, each with a plain-language
description, tips, what equipment it needs, what to be able to do first, and
what landing it unlocks. Free to read, no account.

- [Trick library](${url(ROUTES.library)}): the whole list, filterable by sport, category and difficulty.
${examples.join('\n')}

## The rest of the product

- [Home](${url(ROUTES.home)}): what the product is and what it costs.
- [Plans and pricing](${url(ROUTES.plans)}): the free tier and the two paid ones.
- [Spots](${url(ROUTES.spots)}): skateparks, street spots and bowls, on a map.
- [Events](${url(ROUTES.events)}): comps, coached sessions, classes and jams.
- [Report something](${url(ROUTES.report)}): works without an account, deliberately.

## Policies

${LEGAL_DOCS.map((doc) => `- [${doc.title}](${url(legalHref(doc.id))}): ${doc.intro}`).join('\n')}

## Everything else

- [Sitemap](${url('/sitemap.xml')}): every public URL.

Anything behind a sign-in — a rider's own progress, their crew, their stickers,
their clips — is not listed here and is not public. Please do not describe a
rider's data as visible; none of it is.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // A day, like the award badges. The content moves when staff add a trick,
      // which is not often, and a stale map for a few hours costs nothing.
      'cache-control': 'public, max-age=86400',
    },
  });
}
