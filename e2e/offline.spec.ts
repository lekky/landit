import { OFFLINE_CACHE_VERSION, TRICKS, tricksFor } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

/**
 * The offline read cache and the install manifest (T19; plan §2.3).
 *
 * **Why this needs a browser and cannot be a unit test.** The *policy* — which
 * URLs may be kept — is a pure function with its own tests in
 * `packages/core/src/offline.test.ts` and `apps/web/src/lib/offline.test.ts`.
 * What no unit test can reach is whether a service worker actually installs,
 * claims the page, and answers a navigation from disk when the network is gone.
 * That is three browser APIs cooperating, and the failure mode is silence: a
 * worker that never registers changes nothing on screen, so the first anybody
 * would know is a rider at a park with a blank page.
 *
 * These run in one worker, in order. A service worker is per-origin state
 * shared by every page in the context — one spec clearing the cache while
 * another is filling it is a race with no useful answer.
 */

/*
 * The browser globals the callbacks below run against.
 *
 * Same reason and same shape as `spots.spec.ts`: the e2e tsconfig carries no DOM
 * lib, and these assertions are about browser APIs rather than about anything a
 * locator can see. Declared narrowly, as types only — `declare` erases, so none
 * of this exists at runtime.
 */
declare const navigator: { serviceWorker?: { controller: unknown }; onLine: boolean };
declare const caches: {
  open(name: string): Promise<{ keys(): Promise<{ url: string }[]> }>;
};
declare const window: { dispatchEvent(event: unknown): void; location: { pathname: string } };
declare const Event: new (type: string) => unknown;
declare const URL: new (url: string) => { pathname: string };

test.describe.configure({ mode: 'serial' });

const PAGE_CACHE = `landit-pages-v${OFFLINE_CACHE_VERSION}`;

/** A trick certain to be on the signed-out library grid. */
const someTrick = tricksFor('scooter', TRICKS)[0]!;

/**
 * Wait until the worker has installed *and* taken control of this page.
 *
 * The first load of a new origin is never controlled — the worker is still
 * installing while that page renders — so nothing is cached until it has
 * claimed and a navigation has been through it. Every test here starts by
 * getting past that.
 */
async function controlled(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, {
    timeout: 20_000,
  });
}

/** The paths the worker is currently holding rendered HTML for. */
async function cachedPages(page: Page, cacheName: string): Promise<string[]> {
  return page.evaluate(async (name) => {
    const cache = await caches.open(name);
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  }, cacheName);
}

test('the library is readable with no signal at all', async ({ page, context }) => {
  await page.goto('/library');
  await controlled(page);

  // The second visit is the one that gets cached: it is the first navigation
  // the worker sees.
  await page.reload();
  await expect(page.getByText(someTrick.name).first()).toBeVisible();
  await expect.poll(() => cachedPages(page, PAGE_CACHE), { timeout: 15_000 }).toContain('/library');

  await context.setOffline(true);
  await page.reload();

  // The whole point of the task: the grid is still there, rendered from disk.
  await expect(page.getByText(someTrick.name).first()).toBeVisible();

  await context.setOffline(false);
});

test('losing signal says so, and getting it back takes the bar away', async ({ page }) => {
  await page.goto('/library');
  // The banner is a client component, so nothing it listens for can be heard
  // until the app has hydrated. A controlling worker is proof that it has: the
  // registration happens in an effect (`ServiceWorkerRegistrar`). Without this
  // the test dispatches into a page that is still server-rendered HTML, and on
  // a dev server's first compile of a route that is several seconds.
  await controlled(page);

  const banner = page.getByRole('status').filter({ hasText: 'No signal' });
  await expect(banner).toBeHidden();

  /*
   * A phone losing its radio does two things: `navigator.onLine` goes false and
   * an `offline` event fires. Both are staged here, because the banner reads the
   * flag through `useSyncExternalStore` and takes the event only as the cue to
   * re-read it — an event without the flag is a lie about the connection, and
   * the component is right to ignore it.
   *
   * Staged rather than emulated: Chromium under Playwright's `setOffline` leaves
   * `navigator.onLine` **true**, stopping requests without touching the flag, so
   * neither half happens on its own.
   *
   * That gap is also why the banner has a second signal, which this cannot
   * assert: the worker tells it when a page came off the disk rather than the
   * network, which is the evidence that survives both this emulation and a
   * park's captive wifi. It is verified under `next build && next start`; CI
   * runs this suite against `next dev`, where a cached page loaded with the
   * network down does not finish hydrating, so no client component mounts to be
   * told anything.
   */
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
  });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Logging waits');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    window.dispatchEvent(new Event('online'));
  });
  await expect(banner).toBeHidden();
});

test('a screen nobody cached falls back to the offline page, not a browser error', async ({
  page,
  context,
}) => {
  await page.goto('/library');
  await controlled(page);
  await page.reload();
  await expect(page.getByText(someTrick.name).first()).toBeVisible();

  await context.setOffline(true);

  /*
   * Reading a cached screen first, before asking for an uncached one, is the
   * order this is really about — and the one that was broken.
   *
   * The fallback page went into the cache carrying `content-encoding: gzip`
   * over a body the Cache API had already decoded. Every way of *inspecting*
   * that entry said it was perfect, and serving it to a navigation gave the
   * rider Chromium's "This page couldn't load" behind a 200 that came from our
   * own worker. Ask for the uncached page cold and it happened not to show;
   * this sequence is what showed it (`storable`, in the worker).
   */
  await page.reload();
  await expect(page.getByText(someTrick.name).first()).toBeVisible();

  // `/plans` reads signed out and is deliberately not on the allowlist, so
  // there can be no cached copy of it however the previous test left things.
  await page.goto('/plans');
  await expect(page.getByRole('heading', { name: /No signal/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Your trick library' })).toBeVisible();

  // And again, because a fallback that works exactly once is its own bug.
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: /No signal/ })).toBeVisible();

  await context.setOffline(false);
});

test('nothing outside the allowlist is kept, however much of the app is browsed', async ({
  page,
}) => {
  await page.goto('/library');
  await controlled(page);

  // A tour of screens that must never be on a device: the membership page, a
  // legal document and the landing page.
  for (const path of ['/plans', '/legal/privacy', '/']) {
    await page.goto(path);
  }
  await page.goto('/library');
  await page.goto(`/library/${someTrick.id}`);

  await expect
    .poll(() => cachedPages(page, PAGE_CACHE), { timeout: 15_000 })
    .toEqual(expect.arrayContaining(['/library']));

  const kept = await cachedPages(page, PAGE_CACHE);
  expect(kept.sort()).toEqual(['/library', `/library/${someTrick.id}`].sort());
});

test('the app is installable: a manifest, a scope and icons that resolve', async ({
  page,
  request,
}) => {
  await page.goto('/');

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();

  const manifest = await (await request.get(href!)).json();

  expect(manifest.name).toBe('Land It');
  expect(manifest.display).toBe('standalone');
  // Installed riders open the dashboard, not the sales pitch (`manifest.ts`).
  expect(manifest.start_url).toBe('/home');
  expect(manifest.scope).toBe('/');

  // A manifest that names an icon nobody serves is an app that will not
  // install, and nothing about the page would look wrong.
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  for (const icon of manifest.icons as { src: string; type: string }[]) {
    const response = await request.get(icon.src);
    expect(response.status(), `${icon.src} should be served`).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  }

  // One of them must be maskable, or an Android launcher crops the mark.
  expect(
    (manifest.icons as { purpose?: string }[]).some((icon) => icon.purpose === 'maskable'),
  ).toBe(true);
});
