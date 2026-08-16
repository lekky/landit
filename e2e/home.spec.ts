import { WEEKLY_RIDE_TARGET } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

/**
 * The dashboard (T8), against a real PocketBase — see `playwright.config.ts`.
 *
 * Most of what Home does is arithmetic, and that is unit-tested in
 * `packages/core`. What can only be observed here is the **copy**, and the copy
 * is where two decisions live that nothing else would fail on:
 *
 * - the streak counts **weeks**, not days (plan §1, 2026-08-16), and
 * - nothing on the card is loss-framed (plan §6.4, Standard 13).
 *
 * T5's legal suite exists for the same reason: a copy decision with no test is a
 * copy decision that gets quietly reverted (LESSONS §3a).
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

/*
 * Home reads the *database's* trick library, so "Start here" offers real
 * records and its cards open pages that exist. Without a seed the grid is empty
 * and the trick page 404s — which is how CI caught Home reading the canonical
 * constants instead.
 *
 * The seed is `playwright.config.ts`'s `globalSetup`, which runs once before any
 * worker. It used to be a `beforeAll` here and in two other files, and those
 * three hooks raced each other on a fresh database (issue #68).
 */

function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/** Sign up and walk the four onboarding steps, landing on Home. */
async function arriveAtHome(page: Page, name: string): Promise<void> {
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

test('the dashboard is signed-in only', async ({ page }) => {
  await page.goto('/home');
  await page.waitForURL('**/signin');
});

test('greets the rider by their first name and dates the day', async ({ page }) => {
  await arriveAtHome(page, 'Miles Carter');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alright, Miles.');
  // "Saturday 15 August" — a weekday and a month, built from a table rather
  // than from ICU (LESSONS §3a).
  await expect(
    page.getByText(
      /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December)$/,
    ),
  ).toBeVisible();
});

test('the four stat blocks are there, and the library bar with them', async ({ page }) => {
  await arriveAtHome(page, 'Stat Rider');

  // Scoped to the greeting panel: "Stickers" is also a nav item, a footer link
  // and a section heading, and the stat block is the one being asserted.
  const hero = page.locator('.panel', { hasText: 'Alright,' }).first();
  for (const label of ['Landed', 'Learning', 'Want to', 'Stickers']) {
    await expect(hero.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(hero.getByText(/library$/i)).toBeVisible();
  await expect(hero.getByText(/^\d+ \/ \d+$/)).toBeVisible();
});

test('the streak counts weeks and never days (plan §1)', async ({ page }) => {
  await arriveAtHome(page, 'Streak Rider');

  const card = page.locator('.panel', { hasText: 'Riding streak' }).first();
  await expect(card).toBeVisible();

  // A fresh rider has no run yet, and the card says so in weeks.
  await expect(card.getByText('No weeks yet')).toBeVisible();
  // The word that would mean the 2026-08-16 decision had been undone.
  await expect(card).not.toContainText(/\bdays?\b/i);
});

test('the strip counts this week’s rides, not the days of a week', async ({ page }) => {
  await arriveAtHome(page, 'Strip Rider');

  const card = page.locator('.panel', { hasText: 'Riding streak' }).first();

  // The replacement for the prototype's seven-day strip (plan §7, T8): one cell
  // per ride the week needs, and the count says so in words too.
  await expect(card.getByText(`0 of ${WEEKLY_RIDE_TARGET} rides this week`)).toBeVisible();
  // The prototype's day letters are gone, because they were counting days.
  await expect(card).not.toContainText('M T W T F S S');
});

test('nothing on the streak card is loss-framed (plan §6.4, Standard 13)', async ({ page }) => {
  await arriveAtHome(page, 'Framing Rider');

  const card = page.locator('.panel', { hasText: 'Riding streak' }).first();
  const text = (await card.innerText()).toLowerCase();

  for (const word of [
    'lose',
    'losing',
    'lost',
    'break',
    'broken',
    'dies',
    'expire',
    'hours left',
    "don't",
    'do not lose',
    'last chance',
  ]) {
    expect(text, `the streak card says "${word}"`).not.toContain(word);
  }
});

test('"I rode today" logs a ride and turns green, and a second tap does nothing', async ({
  page,
}) => {
  await arriveAtHome(page, 'Riding Rider');

  const card = page.locator('.panel', { hasText: 'Riding streak' }).first();
  const button = card.getByRole('button', { name: 'I rode today' });
  await expect(button).toBeEnabled();

  await button.click();

  await expect(card.getByRole('button', { name: '✓ Rode today' })).toBeVisible();
  await expect(card.getByText(`1 of ${WEEKLY_RIDE_TARGET} rides this week`)).toBeVisible();
  // Gain-framed, and it names what the next ride earns.
  await expect(card.getByText('One more ride banks this week.')).toBeVisible();

  // One tap a day: the button is spent, and a reload does not bring it back.
  await expect(card.getByRole('button', { name: '✓ Rode today' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.reload();
  await expect(
    page
      .locator('.panel', { hasText: 'Riding streak' })
      .first()
      .getByRole('button', { name: '✓ Rode today' }),
  ).toBeVisible();
});

test('"I rode today" asks for nothing but the tap', async ({ page }) => {
  await arriveAtHome(page, 'Plain Rider');

  const card = page.locator('.panel', { hasText: 'Riding streak' }).first();

  // Plan §1: a plain button that attaches no spot and captures no location, and
  // §6.4 Standard 10 is why. No picker, no prompt, no second step.
  await expect(card.locator('select')).toHaveCount(0);
  await expect(card.locator('input')).toHaveCount(0);
  await expect(card).not.toContainText(/spot|where|location/i);

  const asked: string[] = [];
  await page.context().grantPermissions([]);
  page.on('console', (message) => asked.push(message.text()));
  await card.getByRole('button', { name: 'I rode today' }).click();
  await expect(card.getByRole('button', { name: '✓ Rode today' })).toBeVisible();
  expect(asked.join(' ')).not.toContain('geolocation');
});

test('the crew and sticker panels say what is true rather than showing demo data', async ({
  page,
}) => {
  await arriveAtHome(page, 'Empty Rider');

  // The prototype ships a hard-coded demo crew. A real rider has none, and
  // crews are invite-only with no discovery (plan §6.1) — so the panel says so
  // rather than inventing six riders.
  await expect(page.getByText('No crew yet')).toBeVisible();
  await expect(page.getByText(/invite-only/i)).toBeVisible();
});

test('the nav points at Home now that Home exists', async ({ page }) => {
  await arriveAtHome(page, 'Nav Rider');

  const home = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' });
  await expect(home).toHaveAttribute('href', '/home');
  await expect(home).toHaveAttribute('aria-current', 'page');
});

test('the trick cards and the section head open the library (T7)', async ({ page }) => {
  await arriveAtHome(page, 'Link Rider');

  // T7 merged while T8 was building, so these are wired rather than left as
  // labels. Everything Home points at that is still unbuilt simply has no link.
  await page.getByRole('button', { name: 'Library →' }).click();
  await page.waitForURL('**/library');

  await page.goBack();
  const card = page.locator('.grid-tricks .tcard').first();
  const name = await card.locator('.nm').innerText();
  await card.click();
  await page.waitForURL(/\/library\/.+/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name, { ignoreCase: true });
});
