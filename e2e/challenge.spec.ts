import { SPORTS, SPORT_IDS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { seedLibrary } from './support/seed-library';
import { LIVE_GOAL, seedSchedule } from './support/seed-schedule';
import { finishOnboarding } from './support/onboarding';

/**
 * The challenge screen (T12), for a rider on the free plan.
 *
 * Four decisions here are only observable on the rendered page, and each is one
 * careless edit away from being undone (LESSONS §3a):
 *
 * - **Every sport has a challenge.** Issue #80 was BMX having none, which made
 *   the `challenger` sticker unearnable for a BMX-only rider. The tab strip is
 *   walked from `SPORT_IDS`, so a fourth sport arriving with no schedule fails
 *   this rather than shipping a dead tab.
 * - **The log button works while the week is live, and the count moves.**
 * - **A rider's history starts when they joined.** A challenge that finished
 *   before they had an account is not one they missed, and nothing about it —
 *   not the card, not a "Missed" — reaches the page.
 *
 * What this file can no longer reach (issue #395): the free-plan "Challenge
 * history" panel, and its sentence that the sticker is the same on every plan.
 * A rider signed up during the run joined today, so they can have no finished
 * challenge to put behind it, and PocketBase will not backdate `created` over
 * REST. Until #395 is settled that copy is unasserted.
 *
 * The schedule is seeded by the spec, around today — see `seed-schedule.ts` for
 * why the shipped 2026 weeks cannot be used here. `seedLibrary()` comes first
 * because the paywall hook fails closed on a missing `plans` record.
 */

test.describe.configure({ mode: 'default' });

test.beforeAll(async () => {
  await seedLibrary();
  await seedSchedule();
});

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * A signed-up, onboarded rider on the free plan, riding **every** sport.
 *
 * Every sport, because the point of half this file is that the tab strip has
 * one tab per SPORT_IDS entry and each one has a week running. The four
 * onboarding steps are walked exactly as progress.spec.ts walks them.
 */
async function newRider(page: Page): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Challenge Tester');
  await page.getByLabel('Email').fill(`e2e-challenge-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  for (const sport of SPORT_IDS) {
    await page.getByRole('button', { name: new RegExp(SPORTS[sport].label, 'i') }).click();
  }
  await finishOnboarding(page);
  await page.waitForURL('**/home');
}

test('a live challenge can be logged, and the count moves', async ({ page }) => {
  await newRider(page);
  await page.goto('/challenge');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Live now')).toBeVisible();
  await expect(page.getByText(`0 / ${LIVE_GOAL}`)).toBeVisible();

  await page.getByRole('button', { name: /^Log a /i }).click();

  await expect(page.getByText(`1 / ${LIVE_GOAL}`)).toBeVisible({ timeout: 15_000 });
});

test('every sport has a week running, not just the two the design pack knew about', async ({
  page,
}) => {
  await newRider(page);
  await page.goto('/challenge');

  for (const sport of SPORT_IDS) {
    await page.getByRole('tab', { name: new RegExp(SPORTS[sport].short, 'i') }).click();
    await expect(page.getByText(`Challenge · ${SPORTS[sport].label}`)).toBeVisible();
    await expect(page.getByText('Live now')).toBeVisible();
    await expect(
      page.getByRole('button', { name: new RegExp(`Log a ${sport} thing`) }),
    ).toBeEnabled();
    await expect(page.getByText('No challenge running')).toHaveCount(0);
  }
});

test('a new rider is not shown the challenges that finished before they joined', async ({
  page,
}) => {
  await newRider(page);
  await page.goto('/challenge');

  // `seedSchedule` finished a week in every sport 34 days ago. It ran before
  // this rider had an account, so it is not their history.
  await expect(page.getByText('Past challenges')).toBeVisible();
  await expect(page.getByText('No history yet')).toBeVisible();
  await expect(page.getByText(/^Finished \w+ week$/)).toHaveCount(0);

  // "Completed" / "Missed" are the only two labels a result can carry, and
  // neither is anywhere in the DOM.
  await expect(page.getByText('Completed', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Missed', { exact: true })).toHaveCount(0);
});
