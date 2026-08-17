import {
  HOLDING_PATH,
  PREVIEW_COOKIE,
  PREVIEW_PARAM,
  isPreviewUnlocked,
  isSiteLive,
} from '@landit/core';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * The pre-launch gate: until `LANDIT_SITE_LIVE` says otherwise, every request
 * gets the holding page instead of the product.
 *
 * **Why this file and not a check in a layout.** The same reason the paywall and
 * the consent gate are enforced in PocketBase hooks rather than in the client
 * (plan §3): a gate that a page can forget to call is not a gate. Proxy runs
 * before any route renders and covers every one of them — including Server
 * Functions, which are POSTs to the route that defines them and are therefore
 * gated with it. That is the part that matters here: sign-up is a Server
 * Function, and the whole point of this task is that nobody creates an account
 * in a product that cannot yet honour it.
 *
 * **This is `proxy.ts`, not `middleware.ts`.** Next 16 deprecated and renamed
 * the convention; the functionality is identical. It defaults to the Node.js
 * runtime as of 16, which is what lets it read `LANDIT_SITE_LIVE` from the live
 * environment on every request. That distinction is load-bearing — see the note
 * on flipping the flag below.
 *
 * **Flipping the flag needs a restart, not a rebuild.** `NEXT_PUBLIC_*` values
 * are inlined into the bundle at build time, which cost this project a deploy
 * once already (LESSONS §6). `LANDIT_SITE_LIVE` is deliberately *not* a
 * `NEXT_PUBLIC_` variable: it is read here, on the server, per request. Setting
 * it in Coolify and restarting the app is the whole of going live. CI proves
 * this both ways on the real production image — see the `docker images` job.
 *
 * The decision itself is in `@landit/core` (`launch.ts`) so that `robots.ts` can
 * ask exactly the same question and cannot drift from this file.
 */

/**
 * Paths that stay reachable while the gate is shut.
 *
 * - `/legal/*` — the privacy policy, the terms and the cookie notice are
 *   published commitments, not product. A site that shows a holding page and
 *   hides its privacy policy has the relationship backwards, and the holding
 *   page links to them.
 * - `/robots.txt` — answered by `app/robots.ts`, which reads the same flag and
 *   tells crawlers to index nothing while it is shut. Rewriting it to the
 *   holding page's HTML would leave the site with no robots directives at all,
 *   which is the opposite of what is wanted.
 * - `/api/health` — the deployment's own status (issue #62). It has to answer
 *   before launch above all: that is precisely when a missing superuser
 *   credential is waiting to be found. Gated, it would return the holding page's
 *   HTML with a 200, and a monitor would call that healthy.
 * - `/api/stripe/webhook` — the same trap with money behind it (T15). Stripe
 *   retries anything that is not a 2xx and gives up after a few days; a gated
 *   webhook would answer 200 with the holding page's HTML, so Stripe would call
 *   every payment delivered and no subscription would ever be written. The
 *   route verifies a signature before it does anything, so opening it exposes
 *   nothing the gate was protecting.
 */
const ALWAYS_OPEN = ['/legal', '/robots.txt', '/api/health', '/api/stripe/webhook'];

function isAlwaysOpen(pathname: string): boolean {
  return ALWAYS_OPEN.some((open) => pathname === open || pathname.startsWith(`${open}/`));
}

export function proxy(request: NextRequest): NextResponse {
  const previewKey = process.env.LANDIT_PREVIEW_KEY;

  if (
    isSiteLive({
      siteLive: process.env.LANDIT_SITE_LIVE,
      isProduction: process.env.NODE_ENV === 'production',
    })
  ) {
    return NextResponse.next();
  }

  const { nextUrl } = request;

  /*
   * The escape hatch. `?preview=<key>` on any URL trades the key for a cookie
   * and then redirects to the same URL without it, so the secret does not sit
   * in the address bar, in a screenshot, or in a link that gets forwarded.
   *
   * A wrong key is not an error — it falls through to the holding page, which
   * tells a scanner nothing about whether a key exists.
   */
  const provided = nextUrl.searchParams.get(PREVIEW_PARAM);
  if (provided !== null && isPreviewUnlocked(provided, previewKey)) {
    const onward = new URL(nextUrl);
    onward.searchParams.delete(PREVIEW_PARAM);

    const response = NextResponse.redirect(onward);
    response.cookies.set(PREVIEW_COOKIE, provided, {
      httpOnly: true,
      sameSite: 'lax',
      // Not in development, where the preview is served over plain http and a
      // secure cookie would simply never come back.
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  }

  if (isPreviewUnlocked(request.cookies.get(PREVIEW_COOKIE)?.value, previewKey)) {
    return NextResponse.next();
  }

  if (isAlwaysOpen(nextUrl.pathname) || nextUrl.pathname === HOLDING_PATH) {
    return NextResponse.next();
  }

  /*
   * A rewrite, not a redirect: the visitor keeps the URL they asked for and gets
   * a **200**. Both halves are deliberate.
   *
   * The 200 is because Uptime Kuma watches `https://landthetrick.com` and a
   * launch gate that pages the owner every minute would be turned off within the
   * hour (`docs/infrastructure.md`). A 503 is the more literally correct answer
   * for "not launched yet" and is the thing to revisit if this page ever stands
   * for longer than a few weeks; `robots.ts` carries the no-index in the
   * meantime, which is what actually keeps the half-built site out of search.
   *
   * **The header is for the service worker** (T19). A rewrite keeps the URL the
   * visitor asked for, so a 200 at `/library` here is the holding page wearing
   * the library's address — exactly the thing an offline cache must not keep. The
   * worker refuses any response carrying this, so the worst case is a rider with
   * no cached library rather than a rider whose cached library says "Coming
   * soon". Registration already only happens inside the app shell, which the
   * holding page does not render; this is the second lock on the same door.
   */
  const gated = NextResponse.rewrite(new URL(HOLDING_PATH, request.url));
  gated.headers.set('x-landit-gated', '1');
  return gated;
}

export const config = {
  /*
   * Everything except the things a page is made of. Without a matcher, Proxy
   * runs on `_next/static` too, and the holding page would be gated out of its
   * own stylesheet.
   *
   * `.*\\..*` excludes anything with a file extension, which covers `public/`
   * (the avatar set) and the favicon without naming them one by one. It also
   * excludes `/robots.txt` — which is why `ALWAYS_OPEN` naming it is belt and
   * braces rather than the mechanism.
   */
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};
