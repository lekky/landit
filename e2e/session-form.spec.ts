import { expect, test, type Page } from '@playwright/test';

import { POCKETBASE_URL } from './support/seed-library';
import { finishOnboarding } from './support/onboarding';

/**
 * The session form (T38), for a rider on the free plan.
 *
 * Two things only a rendered page can show, each a decision rather than a
 * detail (LESSONS §3a):
 *
 * - **The three-tap quick log saves**, and the confirmation is the server's —
 *   "Session logged" is rendered from the action's result, never optimistically
 *   (LESSONS §1, "waiting for optimistic copy is waiting for nothing").
 * - **Rookie's clip field is locked**, and says what unlocks it, rather than
 *   taking a link the hook would refuse.
 *
 * The spots are the global setup's (`seed-spots.ts`), so the spot is picked by
 * searching for one the database really holds, not a name this file invents.
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
  await page.getByLabel('Your name').fill('Session Tester');
  await page.getByLabel('Email').fill(`e2e-session-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  await finishOnboarding(page);
  await page.waitForURL((url) => !url.pathname.startsWith('/onboarding'));
}

async function aLiveSpotName(): Promise<string> {
  const response = await fetch(
    `${POCKETBASE_URL}/api/collections/spots/records?perPage=1&sort=name&filter=${encodeURIComponent("status='live'")}`,
  );
  const body = (await response.json()) as { items: { name: string }[] };
  const name = body.items[0]?.name;
  if (!name) throw new Error('The e2e database has no live spot to log a session at.');
  return name;
}

test('a rookie logs a session from the quick log in three taps', async ({ page }) => {
  const spotName = await aLiveSpotName();
  await newRider(page);

  await page.goto('/progress/sessions/new?quick=1');
  await expect(page.getByText('Rode just now')).toBeVisible();

  await page.getByRole('button', { name: /Pick where you rode/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Where did you ride?' });
  await sheet.getByLabel('Search spots').fill(spotName.slice(0, 12));
  await sheet
    .getByRole('button', { name: new RegExp(spotName.slice(0, 12), 'i') })
    .first()
    .click();

  await page.getByRole('radio', { name: /Good/ }).click();
  await page.getByRole('button', { name: 'Log it' }).click();

  await expect(page.getByText('Session logged')).toBeVisible();
  await expect(page.getByText('Anything else while it is fresh?')).toBeVisible();
});

test('a rookie meets the clip field locked, with what unlocks it', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress/sessions/new');

  const clip = page.locator('#session-clip');
  await expect(
    clip.getByText('logs sessions in words. Links come with', { exact: false }),
  ).toBeVisible();
  await expect(clip.getByRole('textbox')).toHaveCount(0);
  await expect(clip.getByRole('link', { name: 'See the plans' })).toBeVisible();
});
