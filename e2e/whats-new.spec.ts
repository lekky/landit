import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';

/**
 * What's new — the bell, its count, and the panel behind it (T47, rethink §3.6).
 *
 * The rules are unit-tested in `packages/core/src/rules/whats-new.test.ts` and
 * the field's own-write rule is proved over HTTP in
 * `pocketbase/tests/whats-new-seen.test.ts`. What can only be observed here is
 * the join: a rider lands a trick in a browser, a badge they never asked for
 * appears on the bell, the sentence behind it says what happened, and marking
 * it read takes the badge away.
 *
 * **Nothing below relies on the `day-one` founder sticker**, which every
 * account created inside the launch window is granted at sign-up. Its window
 * closes on `FOUNDER_JOINED_BY` (2026-09-17), so a spec that counted it would
 * pass today and fail the day after — the same shape of trap as a test written
 * against whatever happened to be in the database. Every assertion here either
 * clears the count first or reads it as a number it worked out itself.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/** Sign up and walk onboarding, landing on Home. Returns the email used. */
async function arrive(page: Page, name: string): Promise<string> {
  const email = `e2e-${unique()}@landit.invalid`;
  await page.goto('/signup');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await finishOnboarding(page);
  await page.waitForURL('**/home');
  return email;
}

/** The bell, wherever the width has put it. Its label carries the count. */
const bell = (page: Page) => page.getByRole('link', { name: /^What’s new/ });

/**
 * Clear the count and come back with it at zero.
 *
 * Opening the panel stamps `whats_new_seen_at`, so this is also the assertion
 * that opening it works: the bell's label loses the count entirely rather than
 * reading "0 unread", which is a sentence about nothing (T45's note in §3.1).
 */
async function clearTheBell(page: Page): Promise<number> {
  await page.goto('/whats-new');
  await expect(page.getByRole('heading', { level: 1, name: 'What’s new' })).toBeVisible();
  const before = await earnedLines(page).count();
  await page.getByRole('button', { name: 'Mark all read' }).click();
  await expect(page.getByRole('button', { name: 'All read' })).toBeDisabled();

  await page.goto('/home');
  await expect(bell(page)).toHaveAccessibleName('What’s new');
  return before;
}

/**
 * The You tab's sticker lines. Counted rather than named: which stickers one
 * landed trick awards belongs to the award rules and the seeded catalogue, and
 * this file is about the bell agreeing with the panel, not about either.
 */
const earnedLines = (page: Page) => page.getByText(/^You earned the .+ sticker\.$/);

/**
 * Press "Sometimes" on the stage picker and be sure the press landed.
 *
 * A server-rendered control is visible before it works, and the library's cards
 * are real links, so the trick page arrives with its own hydration to do —
 * `stickers.spec.ts` names this race in full. `aria-pressed` flipping is the
 * proof, because the picker's state lives in React.
 */
async function landATrick(page: Page): Promise<void> {
  await page.goto('/library');
  // `.tcard` rather than a trick's name: the card's accessible name is the
  // whole card, and which trick it is does not matter to this file. The same
  // locator `stickers.spec.ts` reaches for.
  await page.locator('.tcard').first().click();
  await page.waitForURL(/\/library\/[a-z0-9-]+$/);

  const button = page.getByRole('button', { name: 'Sometimes' });
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }).toPass({ timeout: 20_000 });

  /*
   * Wait for the **toast**, which is the server action having come back.
   *
   * `aria-pressed` is optimistic and flips on the click, so a navigation here
   * leaves mid-write and the bell then counts a `rider_stickers` row the award
   * hook has not created yet — a badge reading zero, intermittently, on a
   * feature that works. `stickers.spec.ts` names the same trap for the wall;
   * it cost this file two runs before it was read.
   *
   * **Attached, not visible**, which that file does not need and this one does:
   * below 860px `additions.css` draws only the newest two toasts, and landing a
   * trick raises three — the stage note and one per sticker. The one waited on
   * here is the oldest of them, so on a 390px phone it is in the document and
   * `display: none`. Being in the document is the fact this wait is about.
   */
  await expect(page.locator('.toast', { hasText: 'Logged as sometimes' })).toBeAttached();
}

test('landing a trick puts a sticker on the bell, and marking it read takes it off', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await arrive(page, 'Bell Rider');

  const before = await clearTheBell(page);
  await landATrick(page);

  /*
   * The count first, and the sentences second.
   *
   * This ordering is the point of the test: the badge is the thing a rider sees
   * without asking, so it is asserted before anything that would only be
   * reachable once the panel works. A spec that opened the page first would
   * fail in its own setup if the count were broken, and the failure would name
   * the wrong thing (LESSONS §5).
   *
   * **The number is neither hard-coded nor "at least one".** How many stickers
   * one landed trick awards belongs to the award rules and the seeded
   * catalogue: it was one when this was written and is two now, without What's
   * new changing at all. What this file is for is the invariant those rules
   * cannot move — **the badge counts exactly the lines that arrived since the
   * rider last looked**. So the count is read off the bell and checked against
   * the panel's growth, which no badge stuck on a constant can satisfy, and
   * which would also catch a count that had quietly gone back to counting
   * everything on the page.
   */
  await page.goto('/home');
  await expect(bell(page)).toHaveAccessibleName(/^What’s new, [1-9]\d* unread\.$/);
  const label = (await bell(page).getAttribute('aria-label')) ?? '';
  const unread = Number(/(\d+) unread/.exec(label)?.[1]);

  await page.goto('/whats-new');
  await expect(page.getByText('Nothing here yet.')).toBeHidden();
  await expect(earnedLines(page).first()).toBeVisible();
  expect(await earnedLines(page).count()).toBe(before + unread);
});

test('a rider with no crew gets no tab row, and one with a crew gets its name', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await arrive(page, 'Crew Rider');

  // A row of one tab is not a choice, so there is no row at all.
  await page.goto('/whats-new');
  await expect(page.getByRole('tablist', { name: 'What’s new' })).toBeHidden();

  const crewName = `Ramp Rats ${unique()}`;
  await page.goto('/crew');
  await page.getByLabel('What is it called?').fill(crewName);
  await page.getByRole('button', { name: 'Start it' }).click();
  await expect(page.getByRole('heading', { name: crewName })).toBeVisible();

  await page.goto('/whats-new');
  const tabs = page.getByRole('tablist', { name: 'What’s new' });
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'You' })).toBeVisible();

  /*
   * The crew tab is the crew's own activity feed, **unchanged**, and the two
   * tabs are told apart by the shape of their rows rather than by their words.
   *
   * A You line is a sentence about the reader — "You earned the … sticker." —
   * with nobody's name in it and nothing to click. A crew row opens with the
   * rider's name as a link to their profile, because that is what the crew
   * screen's feed does and this is that feed in a second place. Starting a crew
   * awards the "Crewed Up" sticker, so a crew of one is not an empty feed: the
   * reader's own sticker comes back to them through the crew, which is exactly
   * why the badge counts the You lines and not these (see `load.ts`).
   */
  await expect(page.getByText(/^You earned the .+ sticker\.$/).first()).toBeVisible();

  await tabs.getByRole('tab', { name: crewName }).click();
  await expect(page.getByRole('link', { name: 'Crew Rider' }).first()).toBeVisible();
  await expect(page.getByText(/earned the .+ sticker$/).first()).toBeVisible();
  await expect(page.getByText(/^You earned the .+ sticker\.$/)).toBeHidden();
});

test('the desktop bell opens the same panel as a dropdown', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await arrive(page, 'Desktop Rider');

  await clearTheBell(page);
  await landATrick(page);
  await page.goto('/home');

  await expect(bell(page)).toHaveAccessibleName(/^What’s new, [1-9]\d* unread\.$/);
  await bell(page).click();

  // The dropdown, not a navigation: the address is the one fact the page and
  // the panel cannot share.
  const panel = page.getByRole('group', { name: 'What’s new' });
  await expect(panel.getByText(/^You earned the .+ sticker\.$/).first()).toBeVisible();
  await expect(page).toHaveURL(/\/home$/);

  /*
   * And the count goes **while the panel is still open**.
   *
   * The number comes from the layout's server render, so clearing it takes a
   * `router.refresh()` after the stamp; without one a rider reads four lines
   * with a badge beside them still saying four until they happen to navigate.
   * The panel staying up through it is the other half of the assertion — a
   * refresh that closed the dropdown would be worse than the stale number.
   */
  await expect(bell(page)).toHaveAccessibleName('What’s new');
  await expect(panel).toBeVisible();
});

test('a rider cannot move another rider’s bookmark', async ({ request }) => {
  const pocketbase = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8091';

  /*
   * Two riders made straight against the API, with no browser at all.
   *
   * The signed-in session lives in one httpOnly cookie, so signing a second
   * rider up in the same page signs the first one out — and `/signup` while
   * signed in goes to Home rather than showing a form. Two riders is the whole
   * point of this test, and what it needs from each of them is a token.
   */
  const makeRider = async (label: string) => {
    const suffix = unique();
    const created = await request.post(`${pocketbase}/api/collections/users/records`, {
      data: {
        email: `e2e-${label}-${suffix}@landit.invalid`,
        password,
        passwordConfirm: password,
        name: `E2E ${label}`,
        handle: `e2e${label}${suffix}`,
        country: 'GB',
        age_band: 'adult',
      },
    });
    expect(created.status()).toBe(200);

    const auth = await request.post(`${pocketbase}/api/collections/users/auth-with-password`, {
      data: { identity: `e2e-${label}-${suffix}@landit.invalid`, password },
    });
    expect(auth.status()).toBe(200);
    return (await auth.json()) as { token: string; record: { id: string } };
  };

  const nosy = await makeRider('nosy');
  const quiet = await makeRider('quiet');

  /*
   * 404 rather than 403, and named rather than "not 200": `users.updateRule` is
   * `id = @request.auth.id`, so another rider's record is not found before any
   * hook runs. Asserting merely that it failed would also pass against a rule
   * that had been loosened and a guard that happened to refuse — a different
   * door, and not this field's.
   */
  const refused = await request.patch(
    `${pocketbase}/api/collections/users/records/${quiet.record.id}`,
    {
      headers: { Authorization: nosy.token },
      data: { whats_new_seen_at: '2099-01-01 00:00:00.000Z' },
    },
  );
  expect(refused.status()).toBe(404);

  // And the world is unchanged, which is the assertion a route that succeeds by
  // doing nothing cannot pass (LESSONS §5).
  const still = await request.get(
    `${pocketbase}/api/collections/users/records/${quiet.record.id}`,
    {
      headers: { Authorization: quiet.token },
    },
  );
  expect(still.status()).toBe(200);
  expect(((await still.json()) as { whats_new_seen_at: string }).whats_new_seen_at).toBe('');
});
