import { SPOTS, type Spot } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

/*
 * The browser globals the callbacks below run against.
 *
 * This project's e2e tsconfig has no DOM lib (see the note in `shell.spec.ts`),
 * and most specs avoid needing one by reading through locators. These tests
 * cannot: a call that is supposed *never* to happen has to be observed at the
 * API it would have gone through. Declared narrowly, as types only — `declare`
 * erases, so nothing here exists at runtime.
 */
declare const window: {
  __geoCalls: number;
  localStorage: unknown;
  sessionStorage: unknown;
};
declare const navigator: object;
declare const document: { cookie: string };

interface StubPosition {
  coords: { latitude: number; longitude: number; accuracy: number };
  timestamp: number;
}

/**
 * Spots and the map (T13; screenshot 19).
 *
 * **This suite runs with no Mapbox token, which is the point.** CI has none and
 * neither does a fresh checkout, so every assertion here is about the half of
 * the screen that must work anyway: the list, the search, the sport filter, the
 * selection, the honest placeholder where the map goes, and the submission form.
 * If a future change makes the screen depend on a live map, this file is what
 * notices — a rider without a working map still has to be able to find a park.
 *
 * **Two things are asserted that nothing else would catch.** That geolocation is
 * *not* asked for on load (Children's code standard 10, plan §6.4) — proved by
 * replacing `navigator.geolocation` with a counter before the page runs, which
 * is the only way to observe a call that is supposed never to happen. And that
 * a signed-out visitor can read the whole screen, which is the API rule's doing
 * and easy to break from the page.
 *
 * The spots come from `@landit/core`'s canonical data, which is what the e2e
 * seed writes (`e2e/support/seed-spots.ts`), so an edit to the data moves the
 * test instead of breaking it.
 */

// Widened from the `as const` seed data so `sports.includes` is a question about
// values rather than about literal types.
const liveSpots: readonly Spot[] = SPOTS.filter((spot) => spot.status === 'live');
const scooterSpot = liveSpots.find((spot) => spot.sports.includes('scooter'))!;
const skateOnlySpot = liveSpots.find(
  (spot) => spot.sports.includes('skate') && !spot.sports.includes('scooter'),
)!;

const card = (page: Page, name: string) =>
  page.locator('[class*="card"]').filter({ hasText: name }).first();

/**
 * Replace the geolocation API with something that counts. Installed before any
 * of the page's own script runs, so a call during hydration is caught too.
 */
async function watchGeolocation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (position: StubPosition) => void) => {
          window.__geoCalls += 1;
          ok({
            coords: { latitude: 53.4084, longitude: -2.9916, accuracy: 40 },
            timestamp: Date.now(),
          });
        },
        watchPosition: () => {
          throw new Error('watchPosition must never be used: it is a live tracking session.');
        },
        clearWatch: () => {},
      },
    });
  });
}

const geoCalls = (page: Page) => page.evaluate(() => window.__geoCalls);

test.describe('where to ride', () => {
  test('lists the live spots to a visitor who is not signed in', async ({ page }) => {
    await page.goto('/spots');

    await expect(page.getByRole('heading', { name: 'Where to ride' })).toBeVisible();

    // The screen opens filtered to the rider's sport, so "every live spot" is
    // only true after the second pill — which is itself the prototype's
    // behaviour and worth pinning down.
    await page.getByRole('button', { name: 'Every spot' }).click();
    for (const spot of liveSpots.slice(0, 3)) {
      await expect(page.getByText(spot.name, { exact: true }).first()).toBeVisible();
    }
  });

  test('narrows the list by search and by sport', async ({ page }) => {
    await page.goto('/spots');
    await page.getByRole('button', { name: 'Every spot' }).click();
    await expect(page.getByText(skateOnlySpot.name, { exact: true }).first()).toBeVisible();

    await page.getByLabel('Search spots').fill(scooterSpot.town);
    await expect(page.getByText(scooterSpot.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(skateOnlySpot.name, { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByText(skateOnlySpot.name, { exact: true }).first()).toBeVisible();
  });

  test('a card and the map header share one selection', async ({ page }) => {
    await page.goto('/spots');
    await page.getByRole('button', { name: 'Every spot' }).click();

    const chosen = card(page, scooterSpot.name);
    await chosen.getByRole('button', { name: 'Show on map' }).click();

    // The map panel's header is ours, not Mapbox's, so it names the selection
    // whether or not a map could be drawn.
    await expect(page.getByRole('link', { name: 'Open in Maps' })).toBeVisible();
    await expect(chosen.getByRole('button', { name: 'On the map' })).toBeVisible();
  });

  test('links out to the spot, and never to where the rider is', async ({ page }) => {
    await page.goto('/spots');
    const directions = card(page, scooterSpot.name).getByRole('link', { name: 'Directions' });
    const href = await directions.getAttribute('href');

    expect(href).toContain(String(scooterSpot.lat));
    // A "directions from here" link would carry an origin. Plan §6.4, standard
    // 10: we store — and send — the spot's location, never the rider's.
    expect(href).not.toMatch(/saddr|origin=/);
  });

  test('says plainly that the map is waiting on a key rather than faking one', async ({ page }) => {
    // CI has no `NEXT_PUBLIC_MAPBOX_TOKEN`, and this is what that has to look
    // like: a sentence, not a broken canvas.
    await page.goto('/spots');
    await expect(page.getByText(/needs a Mapbox key/i)).toBeVisible();
    await expect(page.locator('.mapboxgl-canvas')).toHaveCount(0);
  });

  test('never asks for the rider’s location unless they press for it', async ({ page }) => {
    await watchGeolocation(page);
    await page.goto('/spots');
    await expect(page.getByRole('heading', { name: 'Where to ride' })).toBeVisible();

    // Off by default (plan §6.4, standard 10). Not "asked once and remembered":
    // never asked at all until a rider chooses it.
    expect(await geoCalls(page)).toBe(0);

    await page.getByRole('button', { name: 'Sort by nearest' }).click();
    expect(await geoCalls(page)).toBe(1);

    // A visible indicator while it is on, carrying the way to switch it off.
    await expect(page.getByText('Using your location')).toBeVisible();
    await page.getByRole('button', { name: 'Turn off' }).click();
    await expect(page.getByText('Using your location')).toHaveCount(0);
  });

  test('does not keep the rider’s position anywhere across a reload', async ({ page }) => {
    await watchGeolocation(page);
    await page.goto('/spots');
    await page.getByRole('button', { name: 'Sort by nearest' }).click();
    await expect(page.getByText('Using your location')).toBeVisible();

    const stored = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
      cookie: document.cookie,
    }));
    // 53.4084 / -2.9916 is what the stub hands back. Nothing may have written
    // it down: it never persists across sessions, and it is never ours to keep.
    for (const value of Object.values(stored)) {
      expect(value).not.toContain('53.408');
      expect(value).not.toContain('2.991');
    }

    await page.reload();
    await expect(page.getByText('Using your location')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sort by nearest' })).toBeVisible();
    expect(await geoCalls(page)).toBe(0);
  });

  test('tells a signed-out visitor how to put a spot forward', async ({ page }) => {
    await page.goto('/spots');
    await page.getByRole('button', { name: '+ Add a spot' }).click();
    await expect(page.getByText(/Sign in and you can put one forward/i)).toBeVisible();
  });
});
