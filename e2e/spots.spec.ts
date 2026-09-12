import { SPORT_IDS, SPOTS, sortSpotsByDistance, type Spot } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

// By path, for the reason `support/seed-spots.ts` gives: `@landit/db` is not a
// dependency of the root manifest.
import { franceSpots } from '../packages/db/src/imports/france';

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
  /* Two frames is how the sheet's scroll test waits for a scroll to land. */
  requestAnimationFrame: (run: () => void) => number;
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
 * **This suite asserts nothing about the map drawing, which is the point.**
 * There is no key to be missing since the move to MapLibre and OpenFreeMap
 * (plan §1), but the tiles come from a service with no SLA and CI may have no
 * route to it at all. So every assertion here is about the half of the screen
 * that must work either way: the list, the search, the sport filter, the
 * selection, and the submission form. If a future change makes the screen
 * depend on a live map, this file is what notices — a rider whose map did not
 * load still has to be able to find a park.
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
/**
 * How many live spots the seed puts in the collection: the researched ones
 * above plus France's import (issue #362), which `seed-spots.ts` writes too. The
 * count line claims the whole collection, so the expectation has to as well;
 * everything else in this file still reasons over the researched set, whose
 * names and sports it can rely on.
 */
const seededLiveCount = liveSpots.length + franceSpots().length;
const scooterSpot = liveSpots.find((spot) => spot.sports.includes('scooter'))!;
const skateOnlySpot = liveSpots.find(
  (spot) => spot.sports.includes('skate') && !spot.sports.includes('scooter'),
)!;
/*
 * A park that takes BMX and not scooters, which is the pair the tab row has to
 * be able to tell apart. Plenty of parks ban BMX for pegs and plenty ban
 * scooters outright, so both of these are real and researched — see the note on
 * `SPOTS`.
 */
const bmxNotScooterSpot = liveSpots.find(
  (spot) => spot.sports.includes('bmx') && !spot.sports.includes('scooter'),
)!;

/**
 * Where the geolocation stub says the rider is (Liverpool), and the live spot
 * that is nearest to it.
 *
 * Computed with the same `core` function the screen sorts by rather than
 * hard-coded, for the reason the seed comment gives: an edit to the spot data
 * should move this test, not break it.
 */
const STUB_POINT = { lat: 53.4084, lng: -2.9916 };
const nearestSpot = sortSpotsByDistance(liveSpots, STUB_POINT)[0]!;

const card = (page: Page, name: string) =>
  page.locator('[class*="card"]').filter({ hasText: name }).first();

/**
 * Put one named spot on screen and hand back its card.
 *
 * **Searching rather than scrolling, because the list is paged.** There are a
 * hundred-odd spots across three dozen countries and the screen shows a
 * screenful at a time, so "the spot I want is rendered" stopped being true by
 * accident the moment the data went global — a spec that reached straight for a
 * card was really asserting that the park happened to sort into the first page.
 * Typing its name is also what a rider does, so this exercises the path they
 * use rather than one the tests invented.
 */
/**
 * Wait until the screen is actually listening.
 *
 * **A server-rendered control is visible before it works.** Every pill and
 * button on this screen is painted by the server and only becomes live when
 * React hydrates, and hydration got slower when the list went from seven spots
 * to a hundred-odd — so a press that used to land after hydration by luck
 * started landing before it, roughly one run in three, and the geolocation
 * badge never appeared. Nothing was wrong with the product; the spec was
 * relying on a race it never stated.
 *
 * `aria-pressed` flipping is the proof: the pill's state lives in React, so the
 * attribute cannot change until the component owns the DOM node.
 *
 * It presses a *sport* pill and then puts it back, rather than pressing "Every
 * spot" as it used to. Since the filter became a multi-select the screen opens
 * on "Every spot" already pressed (2026-09-12), so that pill's `aria-pressed`
 * is `true` in the server's own markup and flipping nothing proves nothing. A
 * sport pill starts `false`, so it can only read `true` once React is live —
 * and pressing "Every spot" afterwards leaves the screen unfiltered, which is
 * what the rest of this file expects to find.
 */
async function whenInteractive(page: Page): Promise<void> {
  const sport = page.getByRole('button', { name: /^BMX/ });
  await sport.click();
  await expect(sport).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Every spot' }).click();
  await expect(sport).toHaveAttribute('aria-pressed', 'false');
}

async function findSpot(page: Page, name: string) {
  await whenInteractive(page);
  await page.getByLabel('Search spots').fill(name);
  const found = card(page, name);
  await expect(found).toBeVisible();
  return found;
}

/**
 * Replace the geolocation API with something that counts. Installed before any
 * of the page's own script runs, so a call during hydration is caught too.
 */
async function watchGeolocation(page: Page): Promise<void> {
  // `STUB_POINT` is passed in rather than closed over: an init script is
  // serialised and runs in the browser, where this file's constants do not
  // exist. It is the same value the expected ordering above is computed from,
  // which is the point of threading it through.
  await page.addInitScript((from: { lat: number; lng: number }) => {
    window.__geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (position: StubPosition) => void) => {
          window.__geoCalls += 1;
          ok({
            coords: { latitude: from.lat, longitude: from.lng, accuracy: 40 },
            timestamp: Date.now(),
          });
        },
        watchPosition: () => {
          throw new Error('watchPosition must never be used: it is a live tracking session.');
        },
        clearWatch: () => {},
      },
    });
  }, STUB_POINT);
}

const geoCalls = (page: Page) => page.evaluate(() => window.__geoCalls);

test.describe('where to ride', () => {
  test('lists the live spots to a visitor who is not signed in', async ({ page }) => {
    await page.goto('/spots');

    await expect(page.getByRole('heading', { name: 'Where to ride' })).toBeVisible();

    // **The screen opens on every spot**, with nothing pressed but "Every spot"
    // (owner, 2026-09-12). It used to open filtered to whatever sport the
    // global switch was on, so this count was only true after a press.
    await expect(page.getByRole('button', { name: 'Every spot' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // The count is the claim about the whole collection; the cards below it are
    // one page of that. Asserting the count is what proves the seed landed —
    // asserting three particular cards only proved they sorted early.
    //
    // Scoped to the count line rather than the page, because the sport tabs
    // now carry counts of their own and "98 spots" is briefly true of both the
    // whole list and the Skateboard tab. An unscoped match found two elements
    // and failed on strict mode, which is the locator doing its job.
    await expect(page.locator('[class*="count"]')).toHaveText(
      new RegExp(`${seededLiveCount} spots`),
    );

    // And each of them is reachable, which is the promise that matters.
    for (const spot of liveSpots.slice(0, 3)) {
      await findSpot(page, spot.name);
    }
  });

  test('shows a screenful at a time and grows on a press', async ({ page }) => {
    /*
     * Paging exists because the list went global (2026-08-18). What has to hold
     * is that nothing is *lost* by paging: the count still describes the whole
     * collection, and pressing through reaches the rest.
     */
    await page.goto('/spots');
    await whenInteractive(page);

    const cards = page.locator('[class*="cardBody"]');
    const first = await cards.count();
    expect(first).toBeLessThan(liveSpots.length);

    await page.getByRole('button', { name: /Show \d+ more/ }).click();
    await expect.poll(() => cards.count()).toBeGreaterThan(first);
  });

  test('offers every sport, BMX included', async ({ page }) => {
    /*
     * The defect this pins (owner, 2026-08-31: "doesn't have bmx"), now on the
     * control that replaced the one it was written for.
     *
     * This screen has had two sport controls and both could strand a rider.
     * The prototype's "Switch to {other}" pill picked the first sport that was
     * not the current one — a toggle at two sports, a dead end at three, with
     * BMX unreachable. `SportSwitch` fixed that and introduced its own: it is
     * fed by the rider's own `users.sports` and renders nothing below two, so a
     * rider who records one sport saw no tabs and a pill hard-wired to that
     * sport. The filter row is over `SPORT_IDS` and is the same for everybody.
     *
     * Counting the pills rather than naming them is deliberate: a fourth sport
     * should move this assertion, not slip past it.
     */
    await page.goto('/spots');
    const row = page.getByRole('group', { name: 'Filter spots by sport' });
    // One per sport, plus "Every spot".
    await expect(row.getByRole('button')).toHaveCount(SPORT_IDS.length + 1);
    // And the global tab row is gone from this screen with it.
    await expect(page.getByRole('tablist', { name: 'Spots by sport' })).toHaveCount(0);

    await whenInteractive(page);
    const bmx = row.getByRole('button', { name: /^BMX/ });
    await bmx.click();
    await expect(bmx).toHaveAttribute('aria-pressed', 'true');

    // And it is a real filter, not a pill that only highlights: a park that
    // takes BMX and bans scooters is on the list under BMX and gone under
    // Scooter.
    await page.getByLabel('Search spots').fill(bmxNotScooterSpot.name);
    await expect(card(page, bmxNotScooterSpot.name)).toBeVisible();

    await bmx.click();
    await row.getByRole('button', { name: /^Scooter/ }).click();
    await expect(page.getByText(bmxNotScooterSpot.name, { exact: true })).toHaveCount(0);
  });

  test('takes more than one sport at once', async ({ page }) => {
    /*
     * The ask this row was built for (owner, 2026-09-12: "I just want them to
     * be able to pick everything, or one of each, or multiple"). Neither
     * control this screen had before could express "scooter and BMX" — they
     * were one sport or all of them.
     *
     * Any of the chosen sports, not all: a park that takes BMX and bans
     * scooters belongs in "scooter and BMX", because the rider is asking for
     * both lists at once.
     */
    await page.goto('/spots');
    await whenInteractive(page);

    const row = page.getByRole('group', { name: 'Filter spots by sport' });
    await row.getByRole('button', { name: /^Scooter/ }).click();
    await row.getByRole('button', { name: /^BMX/ }).click();

    // Both pills stay on — pressing the second does not replace the first.
    await expect(row.getByRole('button', { name: /^Scooter/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(row.getByRole('button', { name: /^BMX/ })).toHaveAttribute('aria-pressed', 'true');
    // "Every spot" is off, because this is a narrowing and says so.
    await expect(page.getByRole('button', { name: 'Every spot' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await page.getByLabel('Search spots').fill(bmxNotScooterSpot.name);
    await expect(card(page, bmxNotScooterSpot.name)).toBeVisible();

    // Pressing the last chosen sport off widens back to every spot rather than
    // emptying the screen.
    await page.getByRole('button', { name: 'Clear' }).click();
    await row.getByRole('button', { name: /^Scooter/ }).click();
    await row.getByRole('button', { name: /^BMX/ }).click();
    await expect(page.getByRole('button', { name: 'Every spot' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('narrows the list by search and by sport', async ({ page }) => {
    await page.goto('/spots');
    await findSpot(page, skateOnlySpot.name);

    // A search for one spot's town must not still be showing another's card.
    await page.getByLabel('Search spots').fill(scooterSpot.town);
    await expect(page.getByText(scooterSpot.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(skateOnlySpot.name, { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Clear' }).click();
    await findSpot(page, skateOnlySpot.name);
  });

  test('brings the map to the rider on a phone, and stays out of the way until asked', async ({
    page,
  }) => {
    /*
     * The defect (owner, 2026-08-31: "on mobile you have to click to the bottom
     * of the list to see the map… clicking a spot should show the map, not make
     * the user guess").
     *
     * The map used to be the last thing in the document on a narrow screen —
     * measured at 6,435px down a 7,642px page at this exact viewport, below all
     * 24 cards, and another ~6,000px away with each press of "Show more". So
     * this asserts position rather than mere presence: "the panel is in the
     * DOM" was true the whole time it was unreachable.
     *
     * Nothing here needs the map to draw, which matters because CI never draws
     * one (no GPU, #227). The panel, its header and its footer are ours and
     * exist in both the canvas and the "would not load" states.
     */
    const HEIGHT = 780;
    await page.setViewportSize({ width: 375, height: HEIGHT });
    await page.goto('/spots');
    await whenInteractive(page);

    const panel = page.locator('[class*="mapPanel"]');
    const top = async () => (await panel.boundingBox())!.y;

    // Closed, it is off the bottom of the screen and costs the list nothing.
    expect(await top()).toBeGreaterThanOrEqual(HEIGHT);

    /*
     * **And it holds no map until it is opened** (issue #374). Under WebKit a
     * map built inside the closed sheet — translated below the screen — never
     * paints when the sheet slides up, so every iPhone opened a blank one; the
     * map is now built on the first open, on screen. Counted across both of the
     * map's honest states, because CI may draw either (no GPU there, #227): no
     * canvas and no "would not load" before the press, one of them after it.
     * Whether WebKit then paints is beyond this file — that is a real iPhone's
     * to say, or Playwright's WebKit by eye.
     */
    const mapBuilt = async () =>
      (await page.locator('.maplibregl-canvas').count()) +
      (await page.getByText(/map would not load/i).count());
    await expect.poll(mapBuilt).toBe(0);

    await page.getByRole('button', { name: 'Show on map' }).first().click();
    await expect.poll(mapBuilt, { timeout: 15_000 }).toBeGreaterThan(0);

    /*
     * It clears the bottom nav rather than covering it — a sheet sitting on top
     * of the five nav destinations would trap a rider inside it, so this is the
     * assertion that stops the height creeping until it does.
     *
     * **Polled on the settled edge, not read once.** The sheet slides up over
     * 180ms, and a `boundingBox` taken during that is an honest measurement of
     * a place the sheet is only passing through: the first version of this read
     * the box the moment it came on screen and failed at 997px, which is where
     * it genuinely was, briefly.
     */
    const nav = (await page.locator('.mobnav').boundingBox())!;
    await expect
      .poll(async () => {
        const box = (await panel.boundingBox())!;
        return Math.round(box.y + box.height);
      })
      .toBeLessThanOrEqual(Math.round(nav.y) + 1);

    // And on screen, rather than merely somewhere above the nav.
    expect(await top()).toBeLessThan(HEIGHT);

    /*
     * **At least three quarters of the screen** (Rachid, 2026-09-08: "the map
     * popup on mobile is too small… it needs to be at least 3/4 of the
     * screen"). It was 52% of the viewport capped at 400px, which on this
     * 780px phone was 400px — barely half, and most of that spent on the
     * header, the actions and the footer rather than on map.
     *
     * The floor is the owner's number, not the stylesheet's: 78% is what
     * `--sheet-h` asks for, and asserting 75% leaves room to tune the one
     * without rewriting the other while still failing the day it goes back to
     * being a small panel.
     */
    const height = async () => (await panel.boundingBox())!.height;
    await expect.poll(height).toBeGreaterThanOrEqual(HEIGHT * 0.75);

    // The travel warning follows the map, because the sheet is where a rider
    // decides to go and Directions takes them out of the product from here.
    await expect(page.locator('[class*="mapWarn"]')).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(top).toBeGreaterThanOrEqual(HEIGHT);
  });

  test('the sheet takes the scroll, rather than moving the page behind it', async ({ page }) => {
    /*
     * The defect (Rachid, 2026-09-08, in chat: "when it's open and the user
     * scrolls it actually scrolls the page behind instead of focusing on the
     * slide up panel").
     *
     * The sheet was built docked rather than modal — no scrim, no scroll lock,
     * on the theory that a rider could keep browsing the list behind it. At 52%
     * of the screen that was arguable; at 78% every gesture aimed at the map
     * was landing on a list the rider could no longer see.
     *
     * **What this can and cannot reach.** The page being held still is ours and
     * is asserted here. The other half of the fix — one finger dragging the map
     * instead of the document — is MapLibre's `cooperativeGestures` handler, and
     * CI never draws a map at all (no GPU, #227), so there is no canvas here to
     * drag. That half is pinned by the `gestures` prop's own contract in
     * `SpotMap` rather than by a test that would be asserting on a placeholder.
     */
    const HEIGHT = 780;
    await page.setViewportSize({ width: 375, height: HEIGHT });
    await page.goto('/spots');
    await whenInteractive(page);

    const settle = () =>
      page.evaluate(
        () =>
          new Promise((done) =>
            window.requestAnimationFrame(() => window.requestAnimationFrame(() => done(null))),
          ),
      );

    /*
     * Where the page has got to, read off the top of it rather than out of
     * `window.scrollY`.
     *
     * The hold takes the body out of flow at a negative offset, so while the
     * sheet is up `scrollY` is 0 however far down the list a rider had got —
     * true of the mechanism and useless as a probe, since it reads 0 whether
     * the page is held or scrolled back to the top. Where the heading actually
     * is cannot be fooled either way.
     */
    const heading = page.getByRole('heading', { level: 1, name: 'Where to ride' });
    const pageTop = async () => Math.round((await heading.boundingBox())!.y);

    // Somewhere down the list, so there is a position worth keeping.
    await page.mouse.wheel(0, 600);
    await settle();

    await page.getByRole('button', { name: 'Show on map' }).first().click();
    const scrim = page.locator('[class*="mapScrim"]');
    await expect(scrim).toBeVisible();
    await settle();

    // Read after the sheet is up: pressing "Show on map" scrolls the chosen
    // card into view, so this is the place the rider is actually left.
    const held = await pageTop();
    expect(held).toBeLessThan(0);

    // The gesture that used to move the list behind the map now moves nothing.
    await page.mouse.wheel(0, 600);
    await settle();
    expect(await pageTop()).toBe(held);

    /*
     * A tap on the scrim is the way out a scrim always is — and the assertion
     * after it is the one that matters most: the rider is put back exactly
     * where they were, not at the top of a list they had scrolled through.
     * Holding the page by taking the body out of flow is what makes that a
     * thing to prove rather than a thing that happens for free.
     */
    await scrim.click({ position: { x: 20, y: 20 } });
    await expect(scrim).toHaveCount(0);
    await settle();
    expect(await pageTop()).toBe(held);

    /*
     * And the page scrolls again, which is what stops the check above being
     * vacuous: a wheel that moved nothing at all would have passed it too.
     */
    await page.mouse.wheel(0, 300);
    await expect.poll(pageTop).toBeLessThan(held);
  });

  test('is a column, not a sheet, from 861px up', async ({ page }) => {
    /*
     * The breakpoint is written twice — `@media (max-width: 860px)` in the
     * stylesheet and `SHEET_WIDTH` in `SpotsScreen`, which decides whether an
     * Escape means anything and whether an opened map is counted. This is what
     * notices if the two ever drift: one pixel either side of the line, the
     * whole presentation has to change together.
     */
    await page.setViewportSize({ width: 860, height: 800 });
    await page.goto('/spots');
    await whenInteractive(page);
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
    await expect(page.locator('[class*="mapWarn"]')).toBeVisible();

    await page.setViewportSize({ width: 861, height: 800 });
    // Nothing to close, and gone from the accessibility tree rather than merely
    // invisible: a column that is always on the page has no dismiss.
    await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(0);
    await expect(page.locator('[class*="mapNote"]')).toBeVisible();
    await expect(page.locator('[class*="mapWarn"]')).toBeHidden();
  });

  test('a card and the map header share one selection', async ({ page }) => {
    await page.goto('/spots');
    const chosen = await findSpot(page, scooterSpot.name);
    await chosen.getByRole('button', { name: 'Show on map' }).click();

    // The map panel's header is ours, not Mapbox's, so it names the selection
    // whether or not a map could be drawn.
    await expect(page.getByRole('link', { name: 'Open in Maps' })).toBeVisible();
    await expect(chosen.getByRole('button', { name: 'On the map' })).toBeVisible();
  });

  /*
   * **Navigation owns the card; the map is an explicit button** (design
   * handoff, "Screen 4 — the conflict and the resolution"). The whole box used
   * to select the map, which left the spot's own page — the thing that has a
   * URL, a share and a crawl path — behind a 12px hint. The trade is deliberate
   * and this is the pair of assertions that pins it: pressing the card
   * navigates, and the map only moves when a rider asks it to.
   */
  test('the card is a link to the spot page, and does not move the map', async ({ page }) => {
    await page.goto('/spots');
    const chosen = await findSpot(page, scooterSpot.name);

    // The stretched link's accessible name is the card's, not an arrow: the
    // visible "Spot page →" is decorative and hidden from assistive tech.
    const link = chosen.getByRole('link', { name: /open spot page$/i });
    await expect(link).toHaveAttribute('href', /^\/spots\/[a-z0-9-]+$/);

    // Nothing was selected on the way: the map is still waiting to be asked.
    await expect(page.getByRole('link', { name: 'Open in Maps' })).toHaveCount(0);

    await link.click();
    await page.waitForURL('**/spots/**');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(scooterSpot.name);
  });

  test('"Show on map" is the one control that moves the map', async ({ page }) => {
    await page.goto('/spots');
    const chosen = await findSpot(page, scooterSpot.name);

    await expect(page.getByRole('link', { name: 'Open in Maps' })).toHaveCount(0);
    await chosen.getByRole('button', { name: 'Show on map' }).click();

    await expect(chosen.getByRole('button', { name: 'On the map' })).toBeVisible();
    // And the map panel offers the page too, which is the sheet's first control
    // on a phone — the thumb never hunts for the link behind the map.
    await expect(
      page.getByRole('link', { name: new RegExp(`Open ${scooterSpot.name} page`) }),
    ).toBeVisible();
  });

  test('a link inside a card goes to its own place and leaves the map alone', async ({
    page,
    context,
  }) => {
    /*
     * The card's click handler and the links inside it overlap, and the handler
     * is what has to give way. Directions is the one to prove it on: it opens
     * in its own tab, so the spots page is still there to be asserted about
     * afterwards. Google is never actually reached — the popup is answered
     * locally, because CI is not promised a route to it and a test that needs
     * one is a test that fails for the wrong reason.
     */
    await context.route('https://www.google.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<p>maps</p>' }),
    );

    await page.goto('/spots');
    const chosen = await findSpot(page, scooterSpot.name);

    const opened = context.waitForEvent('page');
    await chosen.getByRole('link', { name: 'Directions' }).click();
    await (await opened).close();

    // Still unselected: the press went to the link and stopped there.
    await expect(chosen.getByRole('button', { name: 'Show on map' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open in Maps' })).toHaveCount(0);
  });

  test('links out to the spot, and never to where the rider is', async ({ page }) => {
    await page.goto('/spots');
    const directions = (await findSpot(page, scooterSpot.name)).getByRole('link', {
      name: 'Directions',
    });
    const href = await directions.getAttribute('href');

    expect(href).toContain(String(scooterSpot.lat));
    // A "directions from here" link would carry an origin. Plan §6.4, standard
    // 10: we store — and send — the spot's location, never the rider's.
    expect(href).not.toMatch(/saddr|origin=/);
  });

  test('serves the map worker as JavaScript, not a 404 page', async ({ page }) => {
    /*
     * The regression this exists for, and the limit of what it can prove.
     *
     * maplibre-gl works out where its worker lives at runtime from
     * `import.meta.url`, which under Next resolves to a hashed chunk — so it
     * asked for `/_next/static/chunks/maplibre-gl-worker.mjs`, got the 404 page,
     * and had its module rejected for the MIME type. Every tile is fetched and
     * parsed in that worker, so the basemap came up **blank** while the markers,
     * the zoom controls and the attribution — all main-thread DOM — rendered
     * perfectly. No `error` event fires for that, so the screen never fell back
     * and nothing in the app noticed. Shipped 2026-08-17; the owner found it in
     * a screenshot.
     *
     * **What this catches:** the sync step (`sync-maplibre-worker.mjs`) being
     * dropped from `build`, or the copied files moving or losing their type.
     *
     * **What it cannot catch, stated so nobody trusts it too far:** whether the
     * map actually *draws*. Headless Chromium has no GPU, so MapLibre fails at
     * WebGL and the component falls back to its placeholder long before a worker
     * is created — the browser error this bug produces never happens here, and
     * asserting on it silently passes forever (LESSONS §5). A blank basemap has
     * to be caught by eye, on a real browser.
     */
    const worker = await page.request.get('/maplibre/maplibre-gl-worker.mjs');
    expect(worker.status()).toBe(200);
    expect(worker.headers()['content-type']).toContain('javascript');

    // The worker imports this by relative path; without it, it fails a second way.
    const shared = await page.request.get('/maplibre/maplibre-gl-shared.mjs');
    expect(shared.status()).toBe(200);
    expect(shared.headers()['content-type']).toContain('javascript');
  });

  test('draws the map panel without taking the list down with it', async ({ page }) => {
    // Tiles come from a service with no SLA and CI is not promised a route to
    // it, so this asserts the contract rather than the pixels: the panel
    // resolves to one honest state, and the list beside it is unaffected either
    // way. The test above is the one that fails when the map is quietly broken.
    await page.goto('/spots');
    await expect(page.getByRole('heading', { name: 'Where to ride' })).toBeVisible();

    const canvas = page.locator('.maplibregl-canvas');
    const excuse = page.getByText(/map would not load/i);
    await expect
      .poll(async () => (await canvas.count()) + (await excuse.count()), { timeout: 15_000 })
      .toBeGreaterThan(0);

    await findSpot(page, scooterSpot.name);
  });

  test('never asks for the rider’s location unless they press for it', async ({ page }) => {
    await watchGeolocation(page);
    await page.goto('/spots');
    await expect(page.getByRole('heading', { name: 'Where to ride' })).toBeVisible();

    // No permission granted to this context, so the screen's silent resume
    // (below) must decline to do anything: standard 10's line is that a browser
    // dialog never appears in front of a rider who did not press for one, and
    // on a browser sitting at `prompt` a `getCurrentPosition` call *is* that
    // dialog. Checked before hydration is waited for, deliberately: a call made
    // during hydration must fail this.
    expect(await geoCalls(page)).toBe(0);

    await whenInteractive(page);
    expect(await geoCalls(page)).toBe(0);

    await page.getByRole('button', { name: 'Near me' }).click();
    expect(await geoCalls(page)).toBe(1);

    // A visible indicator while it is on, carrying the way to switch it off.
    await expect(page.getByText('Using your location')).toBeVisible();
    await page.getByRole('button', { name: 'Turn off' }).click();
    await expect(page.getByText('Using your location')).toHaveCount(0);
  });

  test('opens nearest-first when the browser already allows it', async ({ page, context }) => {
    // The rider granted this on an earlier visit, in their own browser — which
    // is the only state the screen's resume acts on (Rachid, 2026-08-30;
    // §6.4 standard 10). `grantPermissions` is how a test says "they did".
    await context.grantPermissions(['geolocation']);
    await watchGeolocation(page);
    await page.goto('/spots');

    // No press anywhere in this test. The indicator appearing is the assertion:
    // a position is held, and the rider is told so in the same words and with
    // the same way out as when they press for it.
    await expect(page.getByText('Using your location')).toBeVisible();
    await expect(page.getByText(/nearest first/)).toBeVisible();
    expect(await geoCalls(page)).toBe(1);

    // The nearest spot to the stub's position (Liverpool) leads the list. This
    // is the behaviour the rider asked for; the indicator is what makes it fair.
    // Across every sport, so the assertion does not quietly depend on which tab
    // a fresh browser opens on.
    await whenInteractive(page);
    const first = page.locator('[class*="card"]').first();
    await expect(first).toContainText(nearestSpot.name);

    // "Turn off" still ends it, and does not quietly restart: the permission is
    // still granted, so a resume that ignored the press would come straight
    // back and leave a rider unable to switch their location off at all.
    await page.getByRole('button', { name: 'Turn off' }).click();
    await expect(page.getByText('Using your location')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Near me' })).toBeVisible();
    expect(await geoCalls(page)).toBe(1);
  });

  test('keeps the position out of storage even when it resumes on its own', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await watchGeolocation(page);
    await page.goto('/spots');
    await expect(page.getByText('Using your location')).toBeVisible();

    // What may survive a visit is the *browser's* permission, which is the
    // rider's own record in their own settings. The position is still never
    // ours to keep, and the resume must not have become a reason to cache it.
    const stored = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
      cookie: document.cookie,
    }));
    for (const value of Object.values(stored)) {
      expect(value).not.toContain('53.408');
      expect(value).not.toContain('2.991');
    }
  });

  test('does not keep the rider’s position anywhere across a reload', async ({ page }) => {
    await watchGeolocation(page);
    await page.goto('/spots');
    await whenInteractive(page);
    await page.getByRole('button', { name: 'Near me' }).click();
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
    await expect(page.getByRole('button', { name: 'Near me' })).toBeVisible();
    expect(await geoCalls(page)).toBe(0);
  });

  test('tells a signed-out visitor how to put a spot forward', async ({ page }) => {
    await page.goto('/spots');
    await page.getByRole('button', { name: '+ Add a spot' }).click();
    await expect(page.getByText(/Sign in and you can put one forward/i)).toBeVisible();
  });

  test('the What’s on drawer names events, which the bottom bar folds in here', async ({
    page,
  }) => {
    /*
     * Below 861px `.nav` is hidden and the bottom bar carries five sections
     * rather than nine pages, so Spots and Events share one cell. That is only
     * honest if each screen offers the other: highlighting a nav item is not
     * navigation. Before this, Events had no entry on a phone at all.
     */
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/spots');

    /*
     * The drawer opens on arrival, without a tap. That is the whole design: a
     * cell that only opened a drawer would have cost a tap on the way to Spots,
     * so instead arriving in the section announces what else is in it.
     */
    const drawer = page.getByRole('group', { name: 'What’s on', exact: true });
    await expect(drawer.getByRole('link', { name: 'Spots', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await drawer.getByRole('link', { name: 'Events', exact: true }).click();
    await page.waitForURL('**/events');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('What’s coming up');

    // And it takes itself down once the rider has chosen: both screens are the
    // same section, so nothing else would close it and it would sit over the
    // screen it just opened.
    await expect(drawer).toBeHidden();
  });
});
