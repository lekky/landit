import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';

/**
 * The suggestion box, end to end.
 *
 * Two things a rider reported on the live site on 2026-09-13 that no unit test
 * could have caught, because both are about what the browser does:
 *
 *  - **"Send another" did nothing.** It was a link to `/suggest` on `/suggest`,
 *    which Next treats as a soft navigation to where you already are — the
 *    form's action state survived it, so the thank-you panel stayed put.
 *  - **The email address was offered twice** at the foot of the page.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/** Sign up and walk onboarding, landing on Home. */
async function arrive(page: Page): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Idea Rider');
  await page.getByLabel('Email').fill(`e2e-suggest-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await finishOnboarding(page);
  await page.waitForURL('**/home');
}

test('"Send another" puts an empty form back after an idea is sent', async ({ page }) => {
  await arrive(page);
  await page.goto('/suggest');

  await page.getByLabel('What is the idea?').fill('The Bri Flip is not in the scooter library.');
  await page.getByRole('button', { name: 'Send it', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thanks — that is with us.' })).toBeVisible();

  await page.getByRole('button', { name: 'Send another' }).click();

  await expect(page.getByRole('heading', { name: 'Thanks — that is with us.' })).toHaveCount(0);
  await expect(page.getByLabel('What is the idea?')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Send it', exact: true })).toBeEnabled();

  // And the second idea really goes, rather than the form only looking reset.
  await page.getByLabel('What is the idea?').fill('A dark mode, please.');
  await page.getByRole('button', { name: 'Send it', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thanks — that is with us.' })).toBeVisible();
});

test('the email address is offered once, beside "Send it"', async ({ page }) => {
  await arrive(page);
  await page.goto('/suggest');

  await expect(page.locator('form a[href^="mailto:"]')).toHaveCount(1);
  await expect(page.getByText('Prefer email?')).toHaveCount(0);
});
