import { GLOSSARY, glossaryFor } from '@landit/core';
import { expect, test } from '@playwright/test';

/**
 * The glossary (T29; handoff `Glossary.dc.html`).
 *
 * Readable signed out, so nothing here signs in. The counts come from the
 * canonical data rather than being typed, so a term added to `@landit/core`
 * moves the test with it instead of breaking it.
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

test('the sport filter is an address, and pressing a tab rewrites it', async ({ page }) => {
  await page.goto('/glossary?sport=bmx');
  const tabs = page.getByRole('tablist', { name: 'Sport' });
  await expect(tabs.getByRole('tab', { name: /BMX/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(glossaryFor('bmx').length);
  // Brake is a BMX word; Ollie is not scooter's.
  await expect(page.getByRole('heading', { level: 2, name: 'Brake' })).toBeVisible();

  await tabs.getByRole('tab', { name: /Scooter/ }).click();
  await expect(page).toHaveURL('/glossary?sport=scooter');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(glossaryFor('scooter').length);
  await expect(page.getByRole('heading', { level: 2, name: 'Ollie' })).toHaveCount(0);

  // A sport we do not have opens the whole glossary rather than an empty one.
  await page.goto('/glossary?sport=unicycle');
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
