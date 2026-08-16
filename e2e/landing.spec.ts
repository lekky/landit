import { SPORTS, SPORT_IDS } from '@landit/core';
import { expect, test } from '@playwright/test';

/**
 * The landing page (screenshots 01 and 02).
 *
 * The interesting assertion is the last one: the page never writes the sports
 * out, so a two-sport build says two and a three-sport build says three
 * without anyone editing this file or that one. It is the cheapest guard there
 * is against the two-sport assumption the plan keeps warning about (§7).
 */

test('the hero, the sample cards and the footer all render', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every trick');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Proven.');

  // The four sample trick cards from the design pack.
  for (const name of ['Bunny Hop', 'Kickflip', 'Tailwhip', '50-50 Grind']) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }

  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy policy' })).toBeVisible();
});

test('every call to action goes somewhere real', async ({ page }) => {
  await page.goto('/');

  // These were disabled buttons until T6 built the pages behind them. T5 wrote
  // the test that way on purpose — it failed the moment sign-up landed, which
  // is what brought somebody here to change it.
  await expect(page.getByRole('link', { name: 'Start tracking, free' })).toHaveAttribute(
    'href',
    '/signup',
  );
  // The label carries a typographic apostrophe, so match on the tail of it.
  await expect(page.getByRole('link', { name: /got an account/ })).toHaveAttribute(
    'href',
    '/signin',
  );
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
});

test('the footer links to every legal document', async ({ page }) => {
  await page.goto('/');

  const footer = page.getByRole('contentinfo');
  for (const [name, href] of [
    ['Privacy policy', '/legal/privacy'],
    ['Terms of use', '/legal/terms'],
    ['Cookies', '/legal/cookies'],
    ['Safeguarding', '/legal/safeguarding'],
    ['About Land It', '/legal/about'],
  ] as const) {
    await expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  }
});

test('a screen that is not built yet is a label, never a broken link', async ({ page }) => {
  await page.goto('/');

  const footer = page.getByRole('contentinfo');
  // "Plans and pricing" is T15's, the furthest out of the footer's remaining
  // labels. It keeps its place in the footer and stays out of the tab order
  // until then.
  //
  // This exemplar is expected to go stale, and repointing it is the correct
  // response — not deleting the test. It named "Trick library" until T7 built
  // `/library`; `chore-wire-wave4-links` moved it here rather than dropping the
  // guarantee, which is that an unbuilt destination renders as a label. When
  // T15 lands `/plans`, move it to whatever is still unbuilt; when nothing is,
  // the pattern has served its purpose and the test can go with it.
  await expect(footer.getByText('Plans and pricing', { exact: true })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Plans and pricing' })).toHaveCount(0);
});

test('a screen that has been built is a real link', async ({ page }) => {
  await page.goto('/');

  // The other half of the rule above, and the half that has no compile-time
  // guard: `typedRoutes` stops the footer pointing at a route that does not
  // exist, but nothing stops a built screen being left as a dead label for
  // waves after it shipped — which is exactly what had happened to both of
  // these until `chore-wire-wave4-links`.
  const footer = page.getByRole('contentinfo');
  for (const [name, href] of [
    ['Trick library', '/library'],
    ['Progress', '/progress'],
  ] as const) {
    await expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  }
});

test('the sport copy is generated, so BMX needs no edit here', async ({ page }) => {
  await page.goto('/');

  // Whatever `SPORT_IDS` holds, the page names all of it and nothing else.
  for (const id of SPORT_IDS) {
    await expect(page.locator('body')).toContainText(SPORTS[id].label, { ignoreCase: true });
  }

  const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
  await expect(
    page.getByText(`${words[SPORT_IDS.length]} full libraries`, { exact: false }),
  ).toBeVisible();
});
