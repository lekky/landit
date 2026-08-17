import {
  OFFLINE_CACHE_VERSION,
  OFFLINE_PATH,
  isCacheableAsset,
  isCacheablePage,
} from '@landit/core';

/**
 * The offline read cache (plan §2.3, T19).
 *
 * The one promise this keeps: a rider who opened the trick library while they
 * had signal can read it again at a park where they have none. Their tracked
 * stages come with it, because the library and `/progress` are both rendered
 * with those stages already in them. Logging still needs signal, and the app
 * says so rather than pretending — see `OfflineBanner`.
 *
 * **It decides nothing.** Every "may this be kept" question is answered by
 * `@landit/core`'s `offline.ts`, which is pure and unit-tested; this file is the
 * mechanism and nothing else. That split is deliberate: a service worker is
 * unreachable from Vitest and nearly unreachable from Playwright, so the part
 * with a right answer is kept somewhere a test can see it.
 *
 * **Two caches, and only one of them holds a rider.**
 *
 * - `shell` — the offline page and hashed build output. Nothing personal, so it
 *   survives a sign-out.
 * - `pages` — rendered HTML for the three readable screens. This *is* personal:
 *   `/progress` is a rider's own stages. It is thrown away the moment the
 *   signed-in rider changes, including changing to nobody (`reconcileSession`).
 *
 * **What it deliberately does not do.** It does not touch a non-GET request, so
 * no Server Function is ever served from disk and no write is ever replayed. It
 * does not touch another origin, so nothing PocketBase serves against a rider's
 * own token is something this worker can see. And it does not cache a redirect,
 * so the sign-in bounce a signed-out rider gets from `/progress` cannot be
 * frozen into the cache as if it were the screen.
 */

/* --------------------------------------------------- the worker's globals -- */

/**
 * The slice of the ServiceWorker API this file uses, declared here rather than
 * pulled in with `/// <reference lib="webworker" />`.
 *
 * `apps/web/tsconfig.json` compiles this program with `lib: DOM`, and the DOM
 * and WebWorker libs cannot both be loaded — they declare the same names with
 * different types, and the whole app fails to typecheck. Naming the handful of
 * members used here costs twenty lines and keeps the rest of the app compiling.
 */
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEvent extends ExtendableEvent {
  readonly request: Request;
  respondWith(response: Response | Promise<Response>): void;
}

interface MessagePortLike {
  postMessage(message: unknown): void;
}

interface MessageEventLike extends ExtendableEvent {
  readonly data: unknown;
  readonly ports: readonly MessagePortLike[];
}

interface ServiceWorkerScope {
  readonly location: { readonly origin: string };
  readonly clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  addEventListener(type: 'install' | 'activate', run: (event: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', run: (event: FetchEvent) => void): void;
  addEventListener(type: 'message', run: (event: MessageEventLike) => void): void;
}

const sw = self as unknown as ServiceWorkerScope;

/* ----------------------------------------------------------- the caches -- */

const SHELL_CACHE = `landit-shell-v${OFFLINE_CACHE_VERSION}`;
const PAGE_CACHE = `landit-pages-v${OFFLINE_CACHE_VERSION}`;
const KEEP = [SHELL_CACHE, PAGE_CACHE];

/**
 * Where the last-seen rider is remembered.
 *
 * A same-origin path that no route resolves to, holding a `Response` whose body
 * is the rider's id. The Cache API is the only storage a worker has without
 * reaching for IndexedDB, and one string does not justify a database.
 */
const SESSION_MARKER = '/__landit/offline-session';

/**
 * The path of the last navigation this worker answered from disk, or `null` if
 * the last one came off the network.
 *
 * This is how the page finds out it is offline. `navigator.onLine` cannot tell
 * it: that flag reports the network *interface*, so a phone associated with a
 * park's wifi that has no route to anywhere says it is online — and so, it turns
 * out, does Chromium under Playwright's offline emulation, which is how this
 * came to be written rather than assumed. The worker is the only thing in the
 * system that knows a request actually failed.
 *
 * A worker can be killed between serving a page and being asked about it, in
 * which case this is `null` and the rider gets no banner. That is the same
 * outcome as not having built this, so it fails the harmless way.
 */
let servedFromCache: string | null = null;

/* ----------------------------------------------------------- the events -- */

sw.addEventListener('install', (event) => {
  // The fallback page has to be there before the first time there is no signal,
  // which means fetching it while there still is some.
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL_CACHE);
        const response = await fetch(OFFLINE_PATH);
        if (isKeepable(response)) await cache.put(OFFLINE_PATH, await storable(response));
      } catch {
        // A failed precache must not stop the worker installing: without it the
        // rider loses the fallback page, with it they lose the cache entirely.
      }
      await sw.skipWaiting();
    })(),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Every cache this version does not name is a previous version's, and
      // bumping OFFLINE_CACHE_VERSION is how a release throws one away.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('landit-') && !KEEP.includes(name))
          .map((name) => caches.delete(name)),
      );
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;

  // A write is never answered from disk and never replayed. This is the line
  // that keeps "logging needs signal" true rather than approximately true.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (isCacheableAsset(url.pathname)) {
    event.respondWith(handleAsset(request));
  }
});

sw.addEventListener('message', (event) => {
  const message = event.data;
  if (typeof message !== 'object' || message === null) return;

  const { type, rider, path } = message as { type?: unknown; rider?: unknown; path?: unknown };

  if (type === 'landit:session') {
    event.waitUntil(reconcileSession(typeof rider === 'string' ? rider : ''));
    return;
  }

  // "Did you have to serve me from disk?" — asked by `OfflineBanner` on every
  // mount, answered down the port the asker supplied.
  if (type === 'landit:served') {
    event.ports[0]?.postMessage({
      fromCache: servedFromCache !== null && servedFromCache === path,
    });
  }
});

/* --------------------------------------------------------- the strategies -- */

/**
 * Pages: network first, cache second, honest third.
 *
 * Network first and not the other way round because everything here is a live
 * screen when there is signal — a rider who lands a trick and reloads the
 * library must see the new stage, not yesterday's. The cached copy is what they
 * get when the network cannot answer at all, which is the only case this
 * feature is about.
 */
async function handleNavigation(request: Request, url: URL): Promise<Response> {
  try {
    const response = await fetch(request);

    // The network answered, so whatever this worker last served from disk is
    // no longer what the rider is looking at.
    servedFromCache = null;

    if (isCacheablePage(url.pathname) && isKeepable(response)) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(pageKey(url), await storable(response.clone()));
    }

    return response;
  } catch {
    const pages = await caches.open(PAGE_CACHE);
    const cached = await pages.match(pageKey(url));
    if (cached) {
      servedFromCache = url.pathname;
      return cached;
    }

    const shell = await caches.open(SHELL_CACHE);
    const fallback = await shell.match(OFFLINE_PATH);
    if (fallback) return fallback;

    // No network, no copy of this page and no fallback: there is nothing
    // truthful left to render, so say so in the status code rather than
    // inventing a page.
    return new Response('Offline, and nothing cached for this page.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}

/**
 * Assets: cache first, because their URLs are content-addressed.
 *
 * `/_next/static/…` is hashed by the bundler, so a cached copy cannot be a stale
 * version of itself — a changed file is a different URL. This is what makes an
 * offline page render with its stylesheet rather than as unstyled text.
 */
async function handleAsset(request: Request): Promise<Response> {
  const cache = await caches.open(SHELL_CACHE);

  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isKeepable(response)) await cache.put(request, await storable(response.clone()));
  return response;
}

/**
 * A copy of a response that is safe to replay from disk.
 *
 * **The bug this exists for**, because it took a while to find and looks like
 * nothing: the Cache API stores a response's body **decoded**, and its headers
 * **as they arrived**. `next start` gzips HTML, so a cached page keeps
 * `content-encoding: gzip` over a body that is already plain text. Reading it
 * from JavaScript works and looks perfect — `response.text()` returns the real
 * HTML — so every inspection says the cache is fine. Handing the same response
 * to a *navigation* does not: the network stack believes the header, tries to
 * gunzip plain HTML, and the rider gets Chromium's "This page couldn't load"
 * after a 200 that came from us.
 *
 * Rebuilding the response drops that header, and `content-length` with it,
 * since it described the compressed body and is now a lie of a different size.
 */
async function storable(response: Response): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');

  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Throw away every cached page when the rider changes.
 *
 * The worker cannot read the session: the token is in an httpOnly cookie, which
 * is the point of it being there (`lib/session.ts`). So the app tells it who is
 * signed in on every load, and any change — sign-in, sign-out, a second rider on
 * a shared phone — empties the cache that holds rendered screens.
 *
 * The message arrives *after* the navigation that carried it, so the first page
 * cached under a new rider is discarded and re-cached on their next visit. That
 * costs one round trip and buys not having to trust every future sign-out path
 * to remember this file exists.
 */
async function reconcileSession(rider: string): Promise<void> {
  const cache = await caches.open(SHELL_CACHE);

  const previous = await cache.match(SESSION_MARKER);
  const seen = previous ? await previous.text() : null;
  if (seen === rider) return;

  await caches.delete(PAGE_CACHE);
  await cache.put(SESSION_MARKER, new Response(rider));
}

/* ------------------------------------------------------------- the rules -- */

/**
 * May this response be kept at all?
 *
 * - **200 only.** A 404 or a 500 cached is a rider told their tricks are gone.
 * - **Not a redirect.** `/progress` signed out is a bounce to sign-in; frozen
 *   into the cache under `/progress` it would be served forever as that screen.
 * - **Same origin, not opaque.** An opaque response cannot be inspected, so
 *   there is no way to know it is any of the above.
 * - **Not the holding page.** `proxy.ts` marks what it serves while the
 *   pre-launch gate is shut; caching that under `/library` would leave a rider
 *   with "Coming soon" as their offline library (`x-landit-gated`).
 */
function isKeepable(response: Response): boolean {
  return (
    response.status === 200 &&
    !response.redirected &&
    response.type === 'basic' &&
    !response.headers.has('x-landit-gated')
  );
}

/**
 * The cache key for a page: its path, with the query string dropped.
 *
 * The three cacheable screens carry their state in the app rather than in the
 * URL — the sport switch is client state, and the library's filters are too —
 * so a query string here is a share link's tracking parameter far more often
 * than it is a different screen. Keying on the path keeps one entry per screen
 * instead of one per link a rider ever followed.
 */
function pageKey(url: URL): string {
  return url.pathname;
}
