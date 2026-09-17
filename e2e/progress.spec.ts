import { SPORTS, SPORT_IDS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';

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
  // This rider keeps the default sport. Step 1 opens with the first one on and
  // the last sport on cannot be turned off, so its card is `disabled` — pressing
  // it was always a no-op, and since that became visible it is a 30s wait.
  await expect(
    page.getByRole('button', { name: new RegExp(SPORTS.scooter.label, 'i') }),
  ).toHaveAttribute('aria-pressed', 'true');
  await finishOnboarding(page);
  // T8 landed the dashboard, so that is where a finished onboarding goes.
  await page.waitForURL('**/home');
}

test('progress opens on Record, and the tab row is how the rest is reached', async ({ page }) => {
  await newRider(page);

  /*
   * Arrived at from Home's card (T46), which is the only way in now that
   * Progress has no cell of its own (D8). Clicking it rather than typing the
   * URL is the point: the card *is* the navigation, and a card that stopped
   * linking would leave the screen behind it unreachable on a phone.
   */
  await page
    .getByRole('main')
    .getByRole('link', { name: /^Progress/ })
    .first()
    .click();
  await page.waitForURL('**/progress');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Where you’re at');

  // Record leads: by category and by stage, with the printable sheets beside
  // them. Over time and the tree are a tab away, not a scroll away.
  await expect(page.getByText('By stage', { exact: true })).toBeVisible();
  await expect(page.getByText('Printable sheets')).toBeVisible();
  await expect(page.locator('.tree')).toHaveCount(0);

  const tabs = page.getByRole('tablist', { name: 'Progress' });
  await expect(tabs).toBeVisible();

  await tabs.getByRole('tab', { name: 'Over time' }).click();
  await expect(page.getByText(/tricks landed in the last six months/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();

  await tabs.getByRole('tab', { name: 'Skill tree' }).click();
  await expect(page.locator('.tree')).toBeVisible();
  await expect(page.getByText(/Tricks unlock tricks/i)).toBeVisible();
});

test('the three tabs fit on one line, down to the narrowest phone anyone still uses', async ({
  page,
}) => {
  /*
   * `.tabrow .sporttab` is `white-space: nowrap` (§3.3), which means a label
   * that does not fit **overflows its box** rather than wrapping it — so a tab
   * row that is too tight does not look broken, it looks like a word with its
   * end cut off, which is exactly the failure the sport chip's own width test
   * was written for (`shell.spec.ts`, D5).
   *
   * "Skill tree" is the longest of the three and this row is the product's
   * tightest: three equal boxes, each with a 16px icon, on a screen that is
   * mostly bar. The same net `shell.spec.ts` casts over the bottom bar, cast
   * over these three.
   */
  await newRider(page);

  for (const width of [430, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/progress');

    const tabs = page.getByRole('tablist', { name: 'Progress' }).getByRole('tab');
    const overflow = await tabs.evaluateAll((nodes) =>
      nodes.map((n) => n.scrollWidth - n.clientWidth),
    );
    expect(overflow, `a Progress tab is wider than its box at ${width}px`).toEqual(
      overflow.map(() => 0),
    );

    // All three on one line: same height, and the row no taller than one tab.
    const heights = await tabs.evaluateAll((nodes) =>
      nodes.map((n) => Math.round(n.getBoundingClientRect().height)),
    );
    expect(new Set(heights).size, `the Progress tabs disagree on height at ${width}px`).toBe(1);

    // And the row does not push the document sideways.
    await expect
      .poll(() => page.locator('html').evaluate((el) => el.scrollWidth - el.clientWidth), {
        message: `the document scrolls sideways at ${width}px`,
      })
      .toBe(0);
  }
});

test('progress says what it is under, and the link goes there', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress');

  /*
   * §2.3: a screen reached from a Home card carries a Home back link. An
   * ordinary link to `/home`, never `history.back()` — a rider who arrived from
   * a shared link or a search result has no history to go back through, and a
   * control that does nothing on a deep link is worse than no control.
   */
  // Scoped to `<main>`: both bars carry a Home link too, and the one being
  // asserted is the one on the page.
  const back = page.getByRole('main').getByRole('link', { name: 'Home' }).first();
  await expect(back).toHaveAttribute('href', '/home');
  await back.click();
  await page.waitForURL('**/home');
});

test('the insights panel offers a rookie rider nothing to switch on', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress');
  // Insights live on the Over time tab (§3.10): they are what six months of
  // logging *mean*, so they sit with the six months rather than on a tab of
  // their own.
  await page.getByRole('tab', { name: 'Over time' }).click();

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
  await page.getByRole('tab', { name: 'Skill tree' }).click();

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
  await page.getByRole('tab', { name: 'Skill tree' }).click();

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

test('the sport row is gone from this screen, at every number of sports', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress');

  /*
   * D5, and the whole point of the chip: the sport is chosen **once**, in the
   * top bar, and every in-page sport tab row goes. This one used to sit
   * directly above the two panels and was the second row of identically shaped
   * tabs on the screen (#379 item 5). Nothing here is conditional on how many
   * sports the rider does any more — the row does not exist at one sport or at
   * three, which is why this assertion no longer depends on the rider.
   */
  await expect(page.getByRole('tablist', { name: 'Progress by sport' })).toHaveCount(0);
  // The only tab row on the screen is the three-section one.
  await expect(page.getByRole('tablist')).toHaveCount(1);
  expect(SPORT_IDS.length).toBe(3);
});

/*
 * "The Progress drawer is the way to the sticker wall" stood here and went
 * with the drawer (T45, 2026-09-16).
 *
 * Progress, Sessions, Stickers and the Challenge no longer share a folded cell
 * with a drawer to name them: all four are under **Home**, reached from record
 * cards on the dashboard (T46), and each carries a Home back link. What the
 * drawer was a bet on — that a rider would find the second screen behind a
 * caret — is not a bet the product is making any more.
 */
