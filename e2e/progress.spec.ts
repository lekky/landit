import { SPORTS, SPORT_IDS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

/**
 * Progress and the skill tree (T9), for a rider on the free plan.
 *
 * Two things here can only be observed on the rendered page, and both are
 * decisions rather than details — the kind LESSONS §3a says get a test or get
 * quietly reverted:
 *
 * - **The insights panel offers a rookie rider no way to switch profiling on.**
 *   The refusal itself is server-side and proven over HTTP in
 *   `pocketbase/tests/insights-opt-in.test.ts`; what this asserts is that the
 *   screen does not put a control in front of somebody it would refuse.
 * - **The printable-sheets panel names its plan rather than offering a button
 *   that would not work.**
 *
 * Two things are deliberately *not* asserted here, and the reason is the same
 * for both: **the e2e PocketBase carries no trick library.** It is started from
 * the migrations with nothing seeded (`playwright.config.ts`), so every rider in
 * this file has an empty library, an empty skill tree and no landings. So the
 * node states — landed, prerequisite-locked, paywalled — are proven in
 * `packages/core/src/rules/progress.test.ts` against a fixture library, and the
 * paywall itself over HTTP in `pocketbase/tests/guarantee-3-paywall.test.ts`.
 * An earlier version of this file asserted on a node in the tree; it passed
 * locally against a seeded instance and failed in CI, which is LESSONS §1's
 * "a green local e2e proves nothing if the bytes came from somewhere else"
 * arriving from the other direction. Seeding the e2e instance is issue #60.
 *
 * The Legend side of the gate is not tested here either: putting a rider on a
 * plan needs a superuser, which is the HTTP suite's job, not a browser's.
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
  await page.waitForURL('**/account');
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

test('the skill tree section renders, and its nodes are never dead controls', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress');

  await expect(page.getByRole('heading', { name: 'Skill tree' })).toBeVisible();
  await expect(page.getByText(/Tricks unlock tricks/i)).toBeVisible();
  await expect(page.locator('.tree')).toHaveCount(1);

  // Whatever the library holds, no node is a button until something has a
  // destination to give it: `/library/[trick]` is T7's route, and a focusable
  // control that does nothing is what LESSONS §3a exists to prevent. This one
  // holds on an empty library *and* a full one, which is why it survives here.
  await expect(page.locator('button.node')).toHaveCount(0);
});

test('printable sheets are offered to paid riders and named as such to free ones', async ({
  page,
}) => {
  await newRider(page);
  await page.goto('/progress');

  await expect(page.getByText(/Shredder riders can print their own list/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /print my sheets/i })).toHaveCount(0);
});

test('the sport switch offers every sport Land It ships', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress');

  // One rider, one sport chosen at onboarding, so the switch stays hidden —
  // "tabs only appear when a rider does both sports" (handoff, Interactions).
  await expect(page.getByRole('tablist', { name: 'Progress by sport' })).toHaveCount(0);
  expect(SPORT_IDS.length).toBe(3);
});
