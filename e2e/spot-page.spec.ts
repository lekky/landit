import { SPOTS, spotFeature, spotSlug, uniqueSlug, type Spot } from '@landit/core';
import { expect, test } from '@playwright/test';

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

test.describe('a spot page', () => {
  test('opens signed out, with the spot named and placed', async ({ page }) => {
    await page.goto(`/spots/${rich.slug}`);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      `${rich.spot.name}, ${rich.spot.town}`,
    );
    await expect(page).toHaveTitle(new RegExp(rich.spot.name));
    // The breadcrumb places it without a map having to load.
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(
      rich.spot.country ?? '',
    );
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
