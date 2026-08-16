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

test('sign-up is honest about not existing yet', async ({ page }) => {
  await page.goto('/');

  // T6 makes these links. Until then they must not pretend: a disabled button
  // is the point, so when this test starts failing it is because sign-up
  // landed and `AUTH_ROUTES_LIVE` needs flipping.
  await expect(page.getByRole('button', { name: 'Start tracking, free' })).toBeDisabled();
  // The label carries a typographic apostrophe, so match on the tail of it.
  await expect(page.getByRole('button', { name: /got an account/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
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
  // "Trick library" is T7's. It keeps its place in the footer and stays out of
  // the tab order until then.
  await expect(footer.getByText('Trick library', { exact: true })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Trick library' })).toHaveCount(0);
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
