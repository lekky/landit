import { SPORTS, SPORT_IDS, TIERS_LABEL, TRICKS, isTrickLocked, tricksFor } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

/**
 * The trick library, the trick page and the locked trick (T7; screenshots
 * 08–10).
 *
 * **What this file is really for.** The locked page is the visible half of a
 * security guarantee whose enforcing half lives in a PocketBase hook (plan §3,
 * guarantee 3, proved over HTTP in `pocketbase/tests/guarantee-3-paywall.test.ts`).
 * The UI half can be edited away without anything failing: delete the
 * `isTrickLocked` branch and every unit test still passes, the build is green,
 * and a rookie quietly gets the lowdown, the tips and a stage picker for a
 * trick they have not paid for. These assertions are what notice.
 *
 * The tricks are chosen from the canonical data rather than named, so a library
 * edit moves the test with it instead of breaking it.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

const scooterTricks = tricksFor('scooter', TRICKS);

/**
 * A trick whose name is not a substring of another trick's, so "is it on the
 * page" is never ambiguous. Picked from the data rather than typed in, so an
 * edit to the library moves the test instead of breaking it.
 */
const distinct = (candidate: (typeof scooterTricks)[number]): boolean =>
  scooterTricks.filter((t) => t.name.toLowerCase().includes(candidate.name.toLowerCase()))
    .length === 1;

const freeTrick = scooterTricks.find((t) => !isTrickLocked(t, 'rookie') && distinct(t))!;
const lockedTrick = scooterTricks.find((t) => isTrickLocked(t, 'rookie') && distinct(t))!;

/** One trick card in the grid, found by the name it shows. */
const card = (page: Page, name: string) => page.locator('.tcard').filter({ hasText: name });

/*
 * Tests in this file run in order in a single worker rather than one per core.
 *
 * The original reason was the seed: `fullyParallel` split the file across
 * workers and raced the `beforeAll` against itself. That reason is gone — the
 * seed is `playwright.config.ts`'s `globalSetup` since issue #68 — but the
 * setting stays for now. Issues #64 and #72 are open against a test in this
 * file, and changing how many of its sign-ups run at once, in the same commit
 * that moves the seed, would muddy whichever of the two gets investigated next.
 * Removing this line belongs to that fix, not to this one.
 */
test.describe.configure({ mode: 'default' });

/** A brand new rider, on the free plan, through the real sign-up. */
async function signUpRookie(page: Page): Promise<void> {
  const now = new Date();
  const dob = new Date(Date.UTC(now.getUTCFullYear() - 24, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Library Rider');
  await page.getByLabel('Email').fill(`e2e-lib-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(dob);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Step 1 arrives with the first sport already chosen, so clicking one would
  // *deselect* it. The rider keeps the default and moves on.
  await page.waitForURL('**/onboarding');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Just started/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Land my first trick' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "Let's go" }).click();
  // T8 landed the dashboard, so that is where a finished onboarding goes.
  await page.waitForURL('**/home');
}

test('the library lists the tricks, signed out, with one tab per sport', async ({ page }) => {
  await page.goto('/library');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('tricks');
  await expect(card(page, freeTrick.name)).toBeVisible();

  // Three sports since T21 — screenshot 08 shows two because it predates the
  // decision (plan §7 ground rules).
  for (const id of SPORT_IDS) {
    await expect(page.getByRole('tab', { name: new RegExp(SPORTS[id].label, 'i') })).toBeVisible();
  }
  expect(SPORT_IDS.length).toBe(3);
});

test('a paid trick is listed, not hidden, and says which tier it is', async ({ page }) => {
  await page.goto('/library');

  const locked = card(page, lockedTrick.name);
  await expect(locked).toBeVisible();
  await expect(locked).toContainText(TIERS_LABEL[lockedTrick.diff - 1]!);
  await expect(locked).toContainText('Shredder');
});

test('search and the filters narrow the grid', async ({ page }) => {
  await page.goto('/library');

  await page.getByLabel('Search tricks').fill(freeTrick.name);
  await expect(card(page, freeTrick.name)).toBeVisible();
  await expect(card(page, lockedTrick.name)).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(card(page, lockedTrick.name)).toBeVisible();

  // Nothing matches: the empty state offers a way back rather than a blank page.
  await page.getByLabel('Search tricks').fill('zzzz-no-such-trick');
  await expect(page.getByText('Nothing matches')).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(card(page, freeTrick.name)).toBeVisible();
});

test('a rookie is told what their plan covers, without being leant on', async ({ page }) => {
  await signUpRookie(page);
  await page.goto('/library');

  await expect(page.getByText('You’re on Rookie')).toBeVisible();
  await expect(
    page.getByText(`The ${TIERS_LABEL[2]}, ${TIERS_LABEL[3]} and ${TIERS_LABEL[4]}`),
  ).toBeVisible();

  // Plan §6.4, standard 13: no loss framing, no countdown, nothing that reads
  // as a squeeze. A copy edit that adds one has to fail here.
  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const phrase of ['missing out', 'hurry', 'ends in', "don't lose", 'only today']) {
    expect(body).not.toContain(phrase);
  }
});

test('a rookie opening a paid trick gets the lock, not the trick', async ({ page }) => {
  await signUpRookie(page);
  await page.goto(`/library/${lockedTrick.id}`);

  await expect(page.getByRole('heading', { level: 1 })).toContainText(lockedTrick.name);
  await expect(
    page.getByText(`${TIERS_LABEL[lockedTrick.diff - 1]} tier is on Shredder`),
  ).toBeVisible();

  // The tier is what is behind the paywall, so none of it is on the page: not
  // the lowdown, not the tips, and not a stage picker to write with.
  const body = await page.locator('body').innerText();
  expect(body).not.toContain(lockedTrick.about.slice(0, 40));
  expect(body).not.toContain(lockedTrick.tips.slice(0, 40));
  await expect(page.getByRole('button', { name: 'Every time' })).toHaveCount(0);
  await expect(page.getByText('Can you do it?')).toHaveCount(0);
});

test('a rookie can open a free trick and log a stage that sticks', async ({ page }) => {
  await signUpRookie(page);
  await page.goto(`/library/${freeTrick.id}`);

  await expect(page.getByRole('heading', { level: 1 })).toContainText(freeTrick.name);
  await expect(page.getByText('The lowdown')).toBeVisible();
  await expect(page.getByText('Can you do it?')).toBeVisible();

  await page.getByRole('button', { name: 'Sometimes' }).click();
  // The **toast**, not the stage note beside the picker (issues #64, #72). That
  // note is optimistic — `StagePanel` renders it the instant the button is
  // pressed — so waiting on it reloads the page mid-write, aborts the request,
  // and the stage never saves. The toast is rendered from the server action's
  // result, so it is the only one of the two that means the write landed
  // (LESSONS §1).
  await expect(page.locator('.toast', { hasText: /Logged as/i })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Sometimes' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // And the library says so too.
  await page.goto('/library');
  await expect(card(page, freeTrick.name)).toContainText('Sometimes');
});

// Until 2026-08-17 this asserted the clips panel rendered as an upsell. The
// owner reversed clip hosting that day (plan §1, §6.6): Land The Trick hosts no video,
// so the trick page offers none and advertises none. What is asserted now is the
// absence — this is the test that notices if a clips panel, or vault copy,
// reappears on this page by accident. The video-link feature
// (`t15b-video-links`) will replace it with assertions about a pasted link.
test('a trick page neither offers video nor advertises a clip vault', async ({ page }) => {
  await signUpRookie(page);
  await page.goto(`/library/${freeTrick.id}`);

  await expect(page.getByRole('heading', { level: 1 })).toContainText(freeTrick.name);

  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/vault/i);
  expect(body).not.toMatch(/\bclips?\b/i);
  await expect(page.getByRole('button', { name: /add a clip/i })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test('a signed-out visitor can read a trick but not track it', async ({ page }) => {
  await page.goto(`/library/${freeTrick.id}`);

  await expect(page.getByRole('heading', { level: 1 })).toContainText(freeTrick.name);
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Every time' })).toHaveCount(0);
});
