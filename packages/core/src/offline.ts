/**
 * What may be kept on the device, and what may not.
 *
 * Plan §2.3 buys one thing with the web-first decision and refuses another: the
 * trick library and the rider's tracked list are readable at a park with no
 * signal, and logging is not. This file is the *policy* half of that — which
 * URLs a service worker is allowed to keep a copy of. The mechanism is
 * `apps/web/src/sw/service-worker.ts`, which imports these functions and does
 * nothing a rule here has not permitted.
 *
 * **Why the policy lives in `@landit/core`.** Same reasoning as `launch.ts`: a
 * cache allowlist is a policy question with a right answer, the answer is
 * security-relevant, and a service worker is the last place in a codebase anyone
 * ever reads. A worker cannot be unit-tested without a browser; these functions
 * can be, and are (`offline.test.ts`). Getting the allowlist wrong is not a
 * rendering bug — it is a rider's stages sitting in a shared phone's disk cache
 * after they signed out, which is the sort of thing plan §6 is about.
 *
 * The rule this file exists to enforce, stated once: **only the screens a rider
 * may read about themselves, and nothing that names another rider.** The trick
 * library, one trick, and their own progress. Not `/account`, not `/crew`, not
 * `/riders/<handle>`, not `/admin`, not a clip, not an API response, and never
 * anything that is not a plain GET.
 */

/**
 * Bumped when the shape of what is cached changes, not when the code does.
 *
 * The worker's cache names carry this, and activating a worker deletes every
 * cache whose name does not match the current pair. So a bump is how a rider
 * with a stale cache from a previous release gets it thrown away rather than
 * silently kept — the escape hatch for the day a cached page turns out to hold
 * something it should not.
 */
export const OFFLINE_CACHE_VERSION = 1 as const;

/** The page shown when a rider asks for something no cache can answer. */
export const OFFLINE_PATH = '/offline' as const;

/**
 * The screens a signed-in rider may keep.
 *
 * Written out rather than derived from `ROUTES` on purpose. `ROUTES` is a list
 * of *destinations that exist*, and it grows every wave; an allowlist that
 * followed it would silently start caching the next screen somebody adds. This
 * list only ever changes when somebody decides a screen is safe to leave on a
 * device, which is a different decision from "this screen shipped".
 */
const CACHEABLE_PAGES = ['/library', '/progress'] as const;

/**
 * Is this a page whose HTML may be kept for reading offline?
 *
 * `/library` and `/progress` exactly, plus one level below `/library` — a trick
 * detail page, `/library/<slug>`. One level, so a route somebody adds at
 * `/library/<slug>/clips` is not swept in by a prefix match it never asked for.
 *
 * Everything else is false, including the dashboard: `/home` carries the streak
 * and the announcement banner, and a stale streak read at a park is a wrong
 * number rather than an old one.
 */
export function isCacheablePage(pathname: string): boolean {
  const path = normalise(pathname);
  if (CACHEABLE_PAGES.includes(path as (typeof CACHEABLE_PAGES)[number])) return true;

  const segments = path.split('/').filter(Boolean);
  return segments.length === 2 && segments[0] === 'library';
}

/**
 * Is this a build asset that may be kept?
 *
 * Only things whose URL changes when their content does, or that never change
 * at all:
 *
 * - `/_next/static/…` — hashed by the bundler, so a cached copy can never be
 *   the wrong version of itself. This is what makes a cold offline load render
 *   with its stylesheet instead of as unstyled text.
 * - `/avatars/…` and `/icons/…` — the avatar set and the app icons.
 * - the manifest, which the browser re-reads on its own schedule.
 *
 * Deliberately **not** `/_next/image` (it takes a query it would have to be
 * trusted to normalise), and nothing on PocketBase's origin: a rider's records
 * are served from there against their own token, and a worker on this origin
 * neither sees them nor should go looking. Nothing a rider owns is written to
 * disk by an *asset* rule — the only rider-shaped thing this worker keeps is
 * rendered HTML, under `isCacheablePage`, and that is thrown away when the
 * signed-in rider changes.
 */
export function isCacheableAsset(pathname: string): boolean {
  const path = normalise(pathname);
  if (path === '/manifest.webmanifest') return true;
  return (
    path.startsWith('/_next/static/') || path.startsWith('/avatars/') || path.startsWith('/icons/')
  );
}

/**
 * Trailing slashes off, everything else left alone.
 *
 * `/library/` and `/library` are the same screen to a rider and to Next; they
 * are different strings to `includes`. `/` itself survives, because stripping
 * it would turn the root into the empty string.
 */
function normalise(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}
