import { SPORTS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';

/**
 * Progress › Sessions (T37), for a rider who has not logged anything yet.
 *
 * What only the rendered page can show, and what a later change could quietly
 * undo:
 *
 * - **The two Progress tabs are real links**, both ways — `typedRoutes` guards
 *   a link to a route that does not exist, and nothing guards a route that
 *   exists with no link to it (LESSONS §1).
 * - **A rider with no sessions gets a way to log one**, not an empty column.
 * - **The Legend insights card is a teaser, with no control** — session
 *   insights are Legend's and opt-in (plan §6.4 standard 12), so the list
 *   offers nothing to switch on.
 *
 * Sessions with data in them are not seeded here: writing one needs a spot,
 * the rider's clock and, for the ride half, the superuser — the HTTP suite
 * (`pocketbase/tests/sessions.test.ts`) proves the reads and the rules; this
 * proves the screen is reachable and says the right thing when it is empty.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

async function newRider(page: Page): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Sessions Tester');
  await page.getByLabel('Email').fill(`e2e-sessions-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await expect(
    page.getByRole('button', { name: new RegExp(SPORTS.scooter.label, 'i') }),
  ).toHaveAttribute('aria-pressed', 'true');
  await finishOnboarding(page);
  await page.waitForURL('**/home');
}

test('the Sessions tab is reachable from Progress, and back', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress');

  const tabs = page.getByRole('navigation', { name: 'Progress', exact: true });
  await expect(tabs.getByRole('link', { name: 'Where you’re at' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await tabs.getByRole('link', { name: 'Sessions' }).click();
  await page.waitForURL('**/progress/sessions');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Progress');

  await page
    .getByRole('navigation', { name: 'Progress', exact: true })
    .getByRole('link', { name: 'Where you’re at' })
    .click();
  await page.waitForURL('**/progress');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Where you’re at');
});

test('a rider with no sessions is offered a way to log one', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress/sessions');

  await expect(page.getByRole('heading', { name: 'Nothing logged yet' })).toBeVisible();
  const empty = page.getByRole('region', { name: 'Nothing logged yet' });
  await expect(empty.getByRole('link', { name: /log a session/i })).toHaveAttribute(
    'href',
    '/progress/sessions/new',
  );
});

test('the session insights card is a teaser with nothing to switch on', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress/sessions');

  const aside = page.getByRole('complementary', { name: 'Your month' });
  await expect(aside.getByRole('heading', { name: 'Session insights' })).toBeVisible();
  await expect(aside.getByText(/Legend only, and only if you turn it on/)).toBeVisible();
  await expect(aside.getByRole('button')).toHaveCount(0);
});

test('a free rider sees the month allowance and a way to the plans', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress/sessions');

  const aside = page.getByRole('complementary', { name: 'Your month' });
  await expect(aside.getByText('Four left this month')).toBeVisible();
  await expect(aside.getByRole('link', { name: /see the plans/i })).toHaveAttribute(
    'href',
    '/plans',
  );
});
