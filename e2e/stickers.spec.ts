import { expect, test, type Page } from '@playwright/test';

/**
 * The sticker wall, the detail modal, the share card, and the award flow that
 * feeds them (T10), against a real PocketBase — see `playwright.config.ts`.
 *
 * The rules themselves are unit-tested in `packages/core` and proved over HTTP
 * in `pocketbase/tests/sticker-award-flow.test.ts`. What can only be observed
 * here is the join: a rider tracks a trick in a browser, a sticker they never
 * asked for appears, they are told once, and it is on the wall afterwards.
 *
 * The suite's database is seeded from the canonical data by `globalSetup`
 * (`e2e/support/seed-library.ts`) — including `stickers`, which T10 added to
 * that seed. Without it the wall renders "0 of 0" and every assertion below
 * passes by finding nothing, which is LESSONS §5 arriving through the data.
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
async function arrive(page: Page, name: string): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(`e2e-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Just started/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Land my first trick' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "Let's go" }).click();
  await page.waitForURL('**/home');
}

/**
 * Press "Sometimes" on the stage picker, and be sure the press actually landed.
 *
 * **A server-rendered control is visible before it works** — the same race
 * `spots.spec.ts` names in `whenInteractive`, arriving here for a new reason.
 * The library's cards became real `<a href>` links, so opening one is now a
 * document navigation and the trick page arrives freshly server-rendered with
 * its own hydration to do. Before, the card was a `<button>`: a press before
 * hydration did nothing at all, so the spec could not move on until the library
 * was live, and the trick page was then rendered by a React that was already
 * running. The race was always there; the buttons were hiding it.
 *
 * So the press is retried rather than assumed. `aria-pressed` flipping is the
 * proof, exactly as it is on the spots pills: the picker's state lives in
 * React, so the attribute cannot change until the component owns the node.
 * `toPass` stops at the first success, which matters here — pressing the
 * selected stage a second time is how a rider *untracks* it.
 */
async function markSometimes(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Sometimes' });
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }).toPass({ timeout: 20_000 });
}

/** Open the first trick the library offers and mark it landed. */
async function landSomething(page: Page): Promise<string> {
  await page.goto('/library');
  const card = page.locator('.tcard').first();
  const name = await card.locator('.nm').innerText();
  await card.click();
  await page.waitForURL(/\/library\/.+/);
  await markSometimes(page);
  // Wait for the **toast**, which is the server action having come back, not
  // for the stage note beside the picker — that one is optimistic and appears
  // on the click. Waiting on the optimistic copy navigates away mid-write, and
  // the wall then reads a `rider_stickers` row the hook has not created yet.
  await expect(page.locator('.toast', { hasText: 'Logged as sometimes' })).toBeVisible();
  return name;
}

test('the wall is signed-in only', async ({ page }) => {
  await page.goto('/stickers');
  await page.waitForURL('**/signin');
});

test('a fresh wall shows the award set, locked — bar the founder badge', async ({ page }) => {
  await arrive(page, 'Fresh Rider');
  await page.goto('/stickers');

  await expect(page.getByText('Sticker wall')).toBeVisible();
  // "X of N" — the N is the seeded set, and it must not be zero, or this file
  // is asserting over an empty collection. `innerText` is what the CSS renders,
  // and the Anton headline is uppercased there, so the comparison is too.
  const heading = page.getByRole('heading', { level: 1 });
  const count = (await heading.innerText()).toLowerCase();
  expect(count).toMatch(/^\d+ of \d+$/);
  expect(Number(count.split(' of ')[1])).toBeGreaterThan(5);

  // A rider who signed up during the launch window (before 2026-09-17) holds
  // `day-one` from their first second — deliberately, T24's founder badge. A
  // rider after it holds nothing. Either way: at most one earned, the heading
  // agrees with the badges, and the wall is otherwise locked.
  const earned = Number(count.split(' of ')[0]);
  expect(earned).toBeLessThanOrEqual(1);
  await expect(page.locator('.sticker.locked').first()).toBeVisible();
  await expect(page.locator('.sticker:not(.locked)')).toHaveCount(earned);
});

test('landing a trick earns a sticker, announces it once, and puts it on the wall', async ({
  page,
}) => {
  await arrive(page, 'Award Rider');
  await landSomething(page);

  // The award happened in the hook, on the write. The toast is the app saying
  // so — it is not the app deciding (plan §3). One landing now announces
  // several awards at once (the trick's own badge, First Land, and during the
  // launch window Day One), so this asserts presence, not singularity.
  await expect(page.getByText(/Sticker earned: /).first()).toBeVisible();

  // Once. `rider_stickers.seen_at` is stamped after it is shown, so a reload
  // of the same page does not announce it again.
  await page.reload();
  await expect(page.getByText(/Sticker earned: /)).toHaveCount(0);

  await page.goto('/stickers');
  // `toHaveText` compares the DOM text, which the CSS uppercases on screen but
  // not here — unlike `innerText` above.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^[1-9]\d* of \d+$/);
  await expect(page.locator('.sticker:not(.locked)').first()).toBeVisible();
});

test('the detail modal says what a sticker needs, and offers the share card once earned', async ({
  page,
}) => {
  await arrive(page, 'Detail Rider');
  await landSomething(page);
  await page.goto('/stickers');

  await page.locator('.sticker:not(.locked)').first().click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText(/^Earned \d{1,2} \w{3} \d{4}$/)).toBeVisible();

  await modal.getByRole('button', { name: 'Share it' }).click();
  const card = page.getByRole('dialog');
  await expect(card.getByText('Share it')).toBeVisible();
  await expect(card.getByText(/sticker earned on Land The Trick\./)).toBeVisible();
  // The share card's meta line counts weeks, because the streak does (plan §1).
  await expect(card).not.toContainText(/\d+ days? streak/i);
  await expect(card.getByRole('button', { name: 'Copy caption' })).toBeVisible();
});

test('a locked sticker offers no share button', async ({ page }) => {
  await arrive(page, 'Locked Rider');
  await page.goto('/stickers');

  await page.locator('.sticker.locked').first().click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByText('Still locked')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Share it' })).toHaveCount(0);
});

test('the wall promises no posted vinyl and no Crew Pass (plan §2.4)', async ({ page }) => {
  await arrive(page, 'Copy Rider');
  await page.goto('/stickers');

  // The prototype's panel sold a die-cut pack posted to "Crew Pass riders".
  // The Crew Pass was dropped and no pack exists, so neither claim ships.
  const body = (await page.locator('main').innerText()).toLowerCase();
  expect(body).not.toContain('crew pass');
  expect(body).not.toContain('vinyl');
  expect(body).not.toContain('posted');
});

test('no sticker on the wall rewards landing a flip (issue #77)', async ({ page }) => {
  await arrive(page, 'Safety Rider');
  await page.goto('/stickers');

  // `upside` is retired: "Land a scooter flip trick" was the one condition that
  // named difficulty-5 inversions, next to coaching copy that says foam pit
  // first. Its record is `is_live: false`, so it is not on the wall at all.
  const body = (await page.locator('main').innerText()).toLowerCase();
  expect(body).not.toContain('upside down');
  expect(body).not.toContain('flip trick');
});

test('the trick page has its Share it button now the card exists (issue #51)', async ({ page }) => {
  await arrive(page, 'Share Rider');
  const name = await landSomething(page);

  // `visible: true`: the first-landed date is rendered twice and shown once —
  // a chip in the hero above the breakpoint, under the ladder below it.
  const panel = page.locator('.panel', { hasText: 'First landed' }).first();
  await expect(panel.getByText('First landed').filter({ visible: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Share it' }).click();

  const card = page.getByRole('dialog');
  await expect(card.getByText(`Landed the ${name}`, { exact: false }).first()).toBeVisible();
  await expect(card.getByText(/Tracked on Land The Trick\./)).toBeVisible();
  await expect(card).not.toContainText(/\d+ days? streak/i);
});
