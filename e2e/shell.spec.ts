import { SPORT_IDS } from '@landit/core';
import { expect, test } from '@playwright/test';

/**
 * The app shell, driven through `/design/shell`.
 *
 * That page exists because the shell ships a wave before any screen does
 * (T7 onward), so without it there is nothing to render the frame around and
 * nothing for a test to click. It is not in the navigation and it is noindexed.
 */

const SHELL = '/design/shell';

test('the top bar carries the nav above 860px and hands over to the bottom bar below it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(SHELL);

  const topNav = page.getByRole('navigation', { name: 'Main', exact: true });
  const bottomNav = page.getByRole('navigation', { name: 'Main, compact', exact: true });

  await expect(topNav).toBeVisible();
  await expect(bottomNav).toBeHidden();

  await page.setViewportSize({ width: 800, height: 800 });
  await expect(topNav).toBeHidden();
  await expect(bottomNav).toBeVisible();
});

test('the bottom bar is the five the design specifies, in order', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto(SHELL);

  const items = page.getByRole('navigation', { name: 'Main, compact', exact: true }).locator('> *');
  await expect(items).toHaveCount(5);
  await expect(items).toHaveText([/Home/, /Tricks/, /Progress/, /Stickers/, /Crew/]);
});

test('the sport switch offers one tab per sport', async ({ page }) => {
  await page.goto(SHELL);
  const tabs = page.getByRole('tablist', { name: 'Sport', exact: true }).getByRole('tab');
  await expect(tabs).toHaveCount(SPORT_IDS.length);
});

test('switching sport holds across a reload', async ({ page }) => {
  await page.goto(SHELL);

  const tabs = page.getByRole('tablist', { name: 'Sport', exact: true }).getByRole('tab');
  const second = tabs.nth(1);
  const label = await second.innerText();

  await second.click();
  await expect(second).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  const afterReload = page
    .getByRole('tablist', { name: 'Sport', exact: true })
    .getByRole('tab')
    .nth(1);
  await expect(afterReload).toHaveAttribute('aria-selected', 'true');
  expect(await afterReload.innerText()).toBe(label);
});

test('three sport tabs still sit on one line on a 375px phone', async ({ page }) => {
  // The squeeze the plan flags for T5: at three sports the row has to survive
  // the narrowest phone without wrapping. Below 520px the labels shorten and
  // the trick-count notes are dropped to make room.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(SHELL);

  const tabs = page
    .getByRole('tablist', { name: 'Sport, three-sport layout check' })
    .getByRole('tab');
  await expect(tabs).toHaveCount(3);

  const tops = await tabs.evaluateAll((nodes) =>
    nodes.map((n) => Math.round(n.getBoundingClientRect().top)),
  );
  expect(new Set(tops).size).toBe(1);

  // Short label in, full label and note out. Both labels are in the DOM and the
  // stylesheet picks which one shows, so this asserts on visibility rather than
  // on text — the swap is the mechanism being tested.
  const skate = tabs.nth(1);
  await expect(skate.locator('.tab-short')).toBeVisible();
  await expect(skate.locator('.tab-full')).toBeHidden();
  await expect(skate.locator('.n')).toBeHidden();
});

test('a toast appears and clears itself', async ({ page }) => {
  await page.goto(SHELL);

  await page.getByRole('button', { name: 'Stage toast' }).click();
  const toast = page.getByText('Tailwhip · Every time');
  await expect(toast).toBeVisible();

  // The design specifies 3.2 seconds; allow for the render either side.
  await expect(toast).toBeHidden({ timeout: 6000 });
});

test('the modal opens and Escape closes it', async ({ page }) => {
  await page.goto(SHELL);

  await page.getByRole('button', { name: 'Open a modal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Shell preview modal' });
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
