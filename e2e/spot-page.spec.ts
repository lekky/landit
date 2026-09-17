import { SPOTS, spotFeature, spotSlug, uniqueSlug, type Spot } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';

/**
 * One spot's own page, `/spots/[slug]` (`feat-spot-pages`).
 *
 * Three things this asserts that nothing else could:
 *
 *  - **The page is readable signed out**, which is the whole point of it. It is
 *    built to be linked, shared and crawled, and a redirect to `/signin` would
 *    make every URL in the sitemap a lie.
 *  - **The "What's here" grid carries real explanations**, not the tag array
 *    reprinted. That grid is the reason the page is worth publishing at all
 *    (plan §7, spot pages), so a change that quietly reduced it to chips would
 *    turn ninety-odd pages back into ninety-odd doorway pages, and nothing but
 *    this would notice.
 *  - **The submitter is nowhere in the served HTML.** Asserted against the
 *    markup rather than against a locator, because the failure this guards is
 *    a field leaking into an attribute or a JSON-LD node — somewhere no visible
 *    element would show it.
 *
 * Slugs are derived here exactly as the seed derives them: `spotSlug` over the
 * canonical rows in order, with `uniqueSlug` resolving a collision the same way
 * the hook does. That is the same arrangement `e2e/spots.spec.ts` uses for its
 * fixtures — the canonical data is what the e2e database was seeded from, so a
 * spot named here is a spot that is there.
 */

/** Every canonical spot's slug, keyed by name, in the seed's own order. */
const slugs = (() => {
  const seen = new Set<string>();
  const byName = new Map<string, string>();
  for (const spot of SPOTS as readonly Spot[]) {
    const slug = uniqueSlug(spotSlug(spot.name, spot.town), (candidate) => seen.has(candidate));
    seen.add(slug);
    byName.set(`${spot.name}|${spot.town}`, slug);
  }
  return byName;
})();

const spotBy = (name: string, town: string): { spot: Spot; slug: string } => {
  const spot = (SPOTS as readonly Spot[]).find((s) => s.name === name && s.town === town);
  const slug = slugs.get(`${name}|${town}`);
  if (!spot || !slug) throw new Error(`${name}, ${town} is not in the canonical spots any more.`);
  return { spot, slug };
};

/** Four features, a full address and a phone number — the complete listing. */
const rich = spotBy('City Skate', 'Adelaide');
/** Two features, no address, no phone — the real range of the data. */
const sparse = spotBy('Addis Skatepark', 'Addis Ababa');

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

/** A brand new rider, through the real sign-up and the real onboarding. */
async function signUp(page: Page): Promise<void> {
  const now = new Date();
  const dob = new Date(Date.UTC(now.getUTCFullYear() - 24, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Spot Rider');
  await page.getByLabel('Email').fill(`e2e-spot-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(dob);
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await finishOnboarding(page);
  await page.waitForURL('**/home');
}

test.describe('a spot page', () => {
  test('opens signed out, with the spot named and placed', async ({ page }) => {
    await page.goto(`/spots/${rich.slug}`);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      `${rich.spot.name}, ${rich.spot.town}`,
    );
    await expect(page).toHaveTitle(new RegExp(rich.spot.name));
    /*
     * The page places it without a map having to load. It was a breadcrumb
     * (`Spots / Great Britain / Corby`) until T52; the trail's two tail
     * segments were plain text repeating the sub-line under the title, and its
     * one link is `BackLink` now, at §4's 44px rather than 12.5px of
     * unpadded text.
     */
    await expect(page.getByRole('heading', { level: 1 }).locator('..')).toContainText(
      rich.spot.country ?? '',
    );
    await expect(
      page.locator('#main').getByRole('link', { name: 'Spots', exact: true }),
    ).toBeVisible();
    // Signed out is the state under test, so the page must still be offering
    // an account rather than assuming one.
    await expect(page.getByRole('link', { name: 'Sign up free' })).toBeVisible();
  });

  test('explains every feature rather than reprinting the tag', async ({ page }) => {
    await page.goto(`/spots/${rich.slug}`);

    // A regex, because the heading uses a typographic apostrophe and a straight
    // one in a selector matches nothing while looking correct.
    await expect(page.getByRole('heading', { name: /What.s here/ }).first()).toBeVisible();

    for (const tag of rich.spot.tags) {
      const feature = spotFeature(tag);
      expect(feature, `no explanation held for ${tag}`).not.toBeNull();
      await expect(page.getByRole('heading', { level: 3, name: feature!.label })).toBeVisible();
      // The explanation itself, word for word from `@landit/core`. This is the
      // assertion that stops the grid quietly becoming a row of chips.
      await expect(page.getByText(feature!.about, { exact: false })).toBeVisible();
    }
  });

  test('sends a feature to the library, already narrowed', async ({ page }) => {
    await page.goto(`/spots/${rich.slug}`);

    const bowl = spotFeature('Bowl');
    await page.getByRole('link', { name: `${bowl!.label} tricks →` }).click();

    await expect(page).toHaveURL(new RegExp(`/library\\?cat=${bowl!.tricks}$`));
    // The pill is pressed on arrival, not a frame later: the category is read
    // on the server so the first paint is already the narrowed grid.
    await expect(page.getByRole('button', { name: 'Park', exact: true })).toBeVisible();
  });

  test('states what a thin listing does not have, and never fakes it', async ({ page }) => {
    await page.goto(`/spots/${sparse.slug}`);

    await expect(page.getByText('No address listed')).toBeVisible();
    await expect(page.getByText('The map pin is exact, so directions still work.')).toBeVisible();
    await expect(page.getByText('No phone listed')).toBeVisible();
    // The page says two features is all it has rather than padding.
    await expect(page.getByText('all this one has')).toBeVisible();
    await expect(page.getByText('Know this spot?')).toBeVisible();
  });

  test('gives a signed-in rider three equal actions under the hero at 390', async ({ page }) => {
    /*
     * §3.10: Faved · Directions · Log here, three equal actions under the hero
     * on a phone and in the hero band on a desktop. One row in the DOM, laid
     * out twice — so what is worth asserting is the phone, where the row has to
     * fit three controls across 390px without either overflowing the page or
     * dropping any of them below §4's 44px.
     *
     * Signed in, because two of the three are only there for a rider:
     * `SpotFave` renders nothing at all without an account, and "Log here" is
     * behind the sessions preview. A visitor gets Directions, filling the row
     * rather than sitting in a third of it — which the test below this one,
     * signed out, is what proves.
     */
    await page.setViewportSize({ width: 390, height: 844 });
    await signUp(page);
    await page.goto(`/spots/${rich.slug}`);

    const fave = page.getByRole('button', { name: /^Fave/ });
    const directions = page.getByRole('link', { name: /Directions/ });
    const logHere = page.getByRole('link', { name: 'Log here' });

    await expect(fave).toBeVisible();
    await expect(directions).toBeVisible();
    await expect(logHere).toBeVisible();

    const boxes = await Promise.all([fave, directions, logHere].map((c) => c.boundingBox()));
    const widths = boxes.map((box) => box?.width ?? 0);
    const tops = boxes.map((box) => box?.y ?? 0);

    // One row: all three start within a couple of pixels of the same line.
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
    // Equal thirds, give or take the gaps between them.
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(4);
    for (const box of boxes) expect(box?.height).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `the document is ${overflow}px wider than the screen`).toBeLessThanOrEqual(0);

    // "Log here" goes where it went before — the same address the block below
    // it has always used, with the spot's record id and nothing a rider typed.
    await expect(logHere).toHaveAttribute('href', /\/progress\/sessions\/new\?spot=[a-z0-9]{15}$/);
  });

  test('offers a visitor Directions and nothing they cannot have', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/spots/${rich.slug}`);

    await expect(page.getByRole('link', { name: /Directions/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Fave/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Log here' })).toHaveCount(0);
  });

  test('never renders who put the spot forward', async ({ page }) => {
    const response = await page.goto(`/spots/${rich.slug}`);
    const html = (await response?.text()) ?? '';

    expect(html).not.toContain('submitted_by');
    expect(html).not.toContain('submittedBy');
  });

  test('answers a slug nobody has with a 404', async ({ page }) => {
    const response = await page.goto('/spots/no-such-spot-anywhere');
    expect(response?.status()).toBe(404);
  });

  test('is advertised in the sitemap', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();

    expect(xml).toContain(`/spots/${rich.slug}<`);
    expect(xml).toContain(`/spots/${sparse.slug}<`);
    /*
     * Every canonical spot is seeded `live`, so every one of them belongs here.
     * At-least rather than exactly, because this database is shared with the
     * rest of the suite and a spec that approves a submission would otherwise
     * fail this one for doing its own job. What the "live only" half rests on
     * is the filter in `getSpotBySlug` / `listLiveSpots`, and the 404 above.
     */
    const listed = (xml.match(/\/spots\/[^<]+</g) ?? []).length;
    expect(listed).toBeGreaterThanOrEqual(SPOTS.length);
  });
});
