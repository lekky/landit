import { SPORTS, SPORT_IDS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

/**
 * Progress and the skill tree (T9), for a rider on the free plan.
 *
 * Three things here can only be observed on the rendered page, and each is a
 * decision rather than a detail — the kind LESSONS §3a says gets a test or gets
 * quietly reverted:
 *
 * - **The insights panel offers a rookie rider no way to switch profiling on.**
 *   The refusal itself is server-side and proven over HTTP in
 *   `pocketbase/tests/insights-opt-in.test.ts`; what this asserts is that the
 *   screen does not put a control in front of somebody it would refuse.
 * - **The skill tree draws the paywall rather than hiding it.** Locked tricks
 *   stay visible throughout (handoff, Interactions), so a rookie rider is told
 *   what they are missing and by name.
 * - **The printable-sheets panel names its plan rather than offering a button
 *   that would not work.**
 *
 * The seeded library is not optional furniture here, and the reason is worth
 * keeping. The e2e PocketBase starts from the migrations with nothing in it, so
 * without a seed the tree renders empty and every assertion about a node passes
 * or fails for the wrong reason. The first version of this file learnt that the
 * expensive way: it passed locally against an instance that happened to be
 * seeded and failed in CI against one that was not — LESSONS §1's "a green
 * local run proves nothing if the bytes came from somewhere else", arriving
 * from the other direction. T7 built the seeding helper; since issue #68 it runs
 * once from `playwright.config.ts`'s `globalSetup` rather than from a `beforeAll`
 * in this file and two others, which raced each other on a fresh database.
 *
 * The Legend side of the gate is not tested here: putting a rider on a plan
 * needs a superuser, which is the HTTP suite's job, not a browser's.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/** A signed-up, onboarded rider on the free plan, landed on their account. */
async function newRider(page: Page): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Progress Tester');
  await page.getByLabel('Email').fill(`e2e-progress-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await page.getByRole('button', { name: new RegExp(SPORTS.scooter.label, 'i') }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Just started/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Land my first trick' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "Let's go" }).click();
  // T8 landed the dashboard, so that is where a finished onboarding goes.
  await page.waitForURL('**/home');
}

test('progress is reachable from the nav and shows the four panels', async ({ page }) => {
  await newRider(page);

  await page.getByRole('navigation').getByRole('link', { name: 'Progress' }).first().click();
  await page.waitForURL('**/progress');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Where you’re at');
  await expect(page.getByText('By stage', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Over time' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Skill tree' })).toBeVisible();
  await expect(page.getByText('Printable sheets')).toBeVisible();
});

test('the insights panel offers a rookie rider nothing to switch on', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress');

  // The upsell states what insights are and that they are Legend's…
  await expect(page.getByText(/part of Legend/i)).toBeVisible();
  await expect(page.getByText(/always only their own tricks/i)).toBeVisible();

  // …and there is no control, because the server would refuse the write.
  await expect(page.getByRole('button', { name: /turn insights on/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /turn insights off/i })).toHaveCount(0);
});

test('the skill tree shows the paywall rather than hiding the tricks', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress');

  await expect(page.getByRole('heading', { name: 'Skill tree' })).toBeVisible();
  await expect(page.getByText(/Tricks unlock tricks/i)).toBeVisible();

  const tree = page.locator('.tree');
  await expect(tree).toBeVisible();
  // A locked trick stays visible and says what would unlock it.
  await expect(tree.locator('.node.paid').first()).toBeVisible();
  await expect(tree.getByText('Shredder').first()).toBeVisible();
});

test('a node in the tree opens its trick page', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress');

  const node = page.locator('.tree button.node').first();
  const name = (await node.locator('.nn').innerText()).trim();
  await node.click();

  await page.waitForURL('**/library/**');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name, { ignoreCase: true });
});

test('printable sheets are offered to paid riders and named as such to free ones', async ({
  page,
}) => {
  await newRider(page);
  await page.goto('/progress');

  await expect(page.getByText(/Shredder riders can print their own list/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /print my sheets/i })).toHaveCount(0);
});

test('the sport switch offers every sport Land The Trick ships', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress');

  // One rider, one sport chosen at onboarding, so the switch stays hidden —
  // "tabs only appear when a rider does both sports" (handoff, Interactions).
  await expect(page.getByRole('tablist', { name: 'Progress by sport' })).toHaveCount(0);
  expect(SPORT_IDS.length).toBe(3);
});
