import { SPORTS, SPORT_IDS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { seedLibrary } from './support/seed-library';
import { LIVE_GOAL, seedSchedule } from './support/seed-schedule';

/**
 * The weekly challenge (T12), for a rider on the free plan.
 *
 * Four decisions here are only observable on the rendered page, and each is one
 * careless edit away from being undone (LESSONS §3a):
 *
 * - **Every sport has a challenge.** Issue #80 was BMX having none, which made
 *   the `challenger` sticker unearnable for a BMX-only rider. The tab strip is
 *   walked from `SPORT_IDS`, so a fourth sport arriving with no schedule fails
 *   this rather than shipping a dead tab.
 * - **The log button works while the week is live, and the count moves.**
 * - **Past weeks are not merely blurred for a free rider — the results are
 *   not on the page at all.** A blur that can be lifted in dev tools is a
 *   costume, not a limit.
 * - **The free-plan limit does not touch what can be earned.** The panel says
 *   so in as many words, because "history is paid" and "achievements are for
 *   sale" are one careless rewrite apart, and plan §1 forbids the second.
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
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Just started/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Land my first trick' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "Let's go" }).click();
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
    await expect(page.getByText(`Weekly challenge · ${SPORTS[sport].label}`)).toBeVisible();
    await expect(page.getByText('Live now')).toBeVisible();
    await expect(
      page.getByRole('button', { name: new RegExp(`Log a ${sport} thing`) }),
    ).toBeEnabled();
    await expect(page.getByText('No challenge running')).toHaveCount(0);
  }
});

test('a free rider is shown the history is paid — and told it costs them no sticker', async ({
  page,
}) => {
  await newRider(page);
  await page.goto('/challenge');

  await expect(page.getByText('Past weeks')).toBeVisible();
  await expect(page.getByText('Challenge history')).toBeVisible();
  await expect(page.getByText(/same on every plan/i)).toBeVisible();

  // The result itself never reached the browser. "Completed" / "Missed" are the
  // only two labels a result can carry, and neither is anywhere in the DOM.
  await expect(page.getByText('Completed', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Missed', { exact: true })).toHaveCount(0);
});
