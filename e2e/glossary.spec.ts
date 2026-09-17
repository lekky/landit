import { GLOSSARY, glossaryFor } from '@landit/core';
import { expect, test } from '@playwright/test';

import { finishOnboarding, pickEverySport } from './support/onboarding';

/**
 * The glossary (T29; handoff `Glossary.dc.html`).
 *
 * Readable signed out, and most of this reads it that way. The counts come from
 * the canonical data rather than being typed, so a term added to `@landit/core`
 * moves the test with it instead of breaking it.
 *
 * **The sport control is `SportScopeSelect` since T50** (rethink §3.10), which
 * is why one test here does sign in: the control behaves differently for a
 * rider and for a visitor, and that difference is the decision — "Your sport"
 * is not offered to somebody the product has never met (§3.3's T48 correction,
 * LESSONS §3a).
 */

test('reads signed out, with every term on the page under its letter', async ({ page }) => {
  await page.goto('/glossary');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Glossary');
  await expect(page.getByText('The words riders use')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(GLOSSARY.length);

  // The way in from the footer, and the plain way back to the library.
  await expect(page.getByRole('link', { name: 'All tricks' })).toHaveAttribute('href', '/library');
  await expect(
    page.getByRole('contentinfo').getByRole('link', { name: 'Glossary' }),
  ).toHaveAttribute('href', '/glossary');
});

test('a visitor is never offered “your sport”, and gets the whole glossary', async ({ page }) => {
  /*
   * The scope control takes "is anybody signed in" as its own input (rethink
   * §3.3's T48 correction, LESSONS §3a). Signed out there is no sport chip in
   * the top bar, so "Your sport (Scooter)" would be a claim about somebody the
   * product has never met, following a preference they cannot see or change —
   * on a public, crawlable page whose whole justification is a stranger
   * arriving from a search result.
   */
  await page.goto('/glossary');
  const scope = page.getByLabel('Show words for');
  await expect(scope).toHaveValue('all');
  await expect(scope.locator('option[value="chip"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(GLOSSARY.length);
});

test('the sport scope narrows the list and is remembered on the device', async ({ page }) => {
  /*
   * The four sport tabs became `SportScopeSelect` in T50 (§3.10), so the choice
   * is one per screen and per device rather than an address the row rewrote.
   * What it must still do is the thing the tabs did: narrow the list, and to
   * the right words.
   */
  await page.goto('/glossary');
  const scope = page.getByLabel('Show words for');

  await scope.selectOption('bmx');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(glossaryFor('bmx').length);
  // Brake is a BMX word; Ollie is not scooter's.
  await expect(page.getByRole('heading', { level: 2, name: 'Brake' })).toBeVisible();

  // Kept on the device, so a reader who comes back is where they left off.
  await page.reload();
  await expect(page.getByLabel('Show words for')).toHaveValue('bmx');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(glossaryFor('bmx').length);

  await page.getByLabel('Show words for').selectOption('scooter');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(glossaryFor('scooter').length);
  await expect(page.getByRole('heading', { level: 2, name: 'Ollie' })).toHaveCount(0);
});

test('an old ?sport= link still opens on that sport, and a junk one on all of it', async ({
  page,
}) => {
  /*
   * `?sport=skate` was the tab row's own address and could be linked or
   * bookmarked. The row is gone and the control no longer writes the param, but
   * the page still reads it as the screen's **default** — so the link keeps
   * working for a reader with nothing stored on this device (T50, §3.10).
   */
  await page.goto('/glossary?sport=bmx');
  await expect(page.getByLabel('Show words for')).toHaveValue('bmx');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(glossaryFor('bmx').length);

  // A sport we do not have opens the whole glossary rather than an empty one.
  await page.goto('/glossary?sport=unicycle');
  await expect(page.getByLabel('Show words for')).toHaveValue('all');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(GLOSSARY.length);
});

test('a deep link lands on the term and offers the way back to the trick', async ({ page }) => {
  await page.goto('/glossary?from=tailwhip#kerb');
  const kerb = page.locator('article#kerb');
  await expect(kerb).toBeInViewport();
  await expect(kerb.getByRole('heading', { level: 2 })).toHaveText('Kerb');
  await expect(page.getByRole('link', { name: 'Back to the trick' })).toHaveAttribute(
    'href',
    '/library/tailwhip',
  );

  // A `from` that names no trick is not trusted: the plain way back instead.
  await page.goto('/glossary?from=not-a-trick');
  await expect(page.getByRole('link', { name: 'All tricks' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the trick' })).toHaveCount(0);
});

test('the jump strip links only the letters that have entries', async ({ page }) => {
  await page.goto('/glossary');
  const strip = page.getByRole('navigation', { name: 'Jump to letter' });
  await expect(strip.getByRole('link', { name: 'K', exact: true })).toHaveAttribute(
    'href',
    '#letter-k',
  );
  // Nothing starts with X or Z, so neither is a link.
  await expect(strip.getByRole('link', { name: 'X', exact: true })).toHaveCount(0);
  await strip.getByRole('link', { name: 'W', exact: true }).click();
  await expect(page.locator('#letter-w')).toBeInViewport();
});

test('a signed-in rider opens the glossary on their own sport', async ({ page }) => {
  /*
   * O1, 2026-09-16 (Rachid, in chat): "Sessions and the glossary open on your
   * sport". The option is stored as the word `chip` rather than as a sport id,
   * so switching sport in the top bar switches this list with it — which is
   * what D5 means by the sport being chosen once.
   */
  const unique = Math.random().toString(36).slice(2, 10);
  const now = new Date();
  const dob = new Date(Date.UTC(now.getUTCFullYear() - 24, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Glossary Tester');
  await page.getByLabel('Email').fill(`e2e-glossary-${unique}@landit.invalid`);
  await page.getByLabel('Password').fill('a-long-local-test-password');
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(dob);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  await pickEverySport(page);
  await finishOnboarding(page);
  await page.waitForURL('**/home');

  await page.goto('/glossary');
  const scope = page.getByLabel('Show words for');
  await expect(scope).toHaveValue('chip');
  await expect(scope.locator('option[value="chip"]')).toHaveText(/^Your sport \(.+\)$/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(glossaryFor('scooter').length);
});
