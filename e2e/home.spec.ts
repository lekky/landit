import { TRICKS, WEEKLY_RIDE_TARGET, isTrickLocked } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';

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

// Scooter, because onboarding leaves the first sport chosen and the dashboard
// follows the top bar's chip (D5) — so these are the tricks Home is counting.
const scooterTricks = TRICKS.filter((t) => t.sport === 'scooter' && t.isLive);

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
  await finishOnboarding(page);
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

/*
 * The four record cards (T46, rethink §3.4).
 *
 * These are not decoration that happens to be clickable. Folding nine
 * destinations into four groups (D8) took Progress, Sessions, Stickers and the
 * Challenge off both bars, so these cards are the **only** way a rider reaches
 * any of them — the same defect `lib/nav.test.ts` exists to stop, arriving from
 * the other side: the bar can claim to reach a screen all it likes, and if the
 * card that does the reaching is missing, the screen is gone on a phone.
 */
test('the four record cards are the way to the four screens under Home', async ({ page }) => {
  await arriveAtHome(page, 'Card Rider');

  const main = page.getByRole('main');
  for (const [title, href] of [
    ['Progress', '/progress'],
    // Sessions is drawn for a rider the preview covers, which the e2e server
    // opens to everybody (`LANDIT_SESSIONS_OPEN=1` in `playwright.config.ts`).
    ['Sessions', '/progress/sessions'],
    ['Stickers', '/stickers'],
    ['Challenge', '/challenge'],
  ] as const) {
    const card = main.getByRole('link', { name: new RegExp(`^${title}`) }).first();
    await expect(card, `the ${title} card is missing from Home`).toBeVisible();
    await expect(card).toHaveAttribute('href', href);
  }
});

test('a record card lands on its screen, and the screen says it is under Home', async ({
  page,
}) => {
  await arriveAtHome(page, 'Sticker Rider');

  await page
    .getByRole('main')
    .getByRole('link', { name: /^Stickers/ })
    .first()
    .click();
  await page.waitForURL('**/stickers');

  // §2.3: the back link is a real link to `/home`, not `history.back()`.
  const back = page.getByRole('main').getByRole('link', { name: 'Home' }).first();
  await expect(back).toHaveAttribute('href', '/home');
});

test('the record cards hold their 2 × 2 without pushing the page sideways', async ({ page }) => {
  await arriveAtHome(page, 'Narrow Rider');

  /*
   * The cards are the first thing a thumb reaches, and they carry the longest
   * strings on the dashboard: a challenge title plus "Ends Saturday", a spot
   * name plus a date. A grid that grows past its share takes the whole document
   * with it, which is a page that can be pushed off-centre on every screen the
   * bottom bar is on — the same net `shell.spec.ts` casts over the bar.
   */
  for (const width of [430, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/home');

    const cards = page.getByRole('main').getByRole('link', { name: /^(Progress|Stickers)/ });
    const heights = await cards.evaluateAll((nodes) =>
      nodes.map((n) => Math.round(n.getBoundingClientRect().height)),
    );
    expect(heights.length, `the cards are missing at ${width}px`).toBeGreaterThan(0);

    await expect
      .poll(() => page.locator('html').evaluate((el) => el.scrollWidth - el.clientWidth), {
        message: `the dashboard scrolls sideways at ${width}px`,
      })
      .toBe(0);
  }
});

test('a crew line on Home says who did it, as a sentence', async ({ page }) => {
  /*
   * The defect this exists for (review B1): `crewActivityLine` in
   * `@landit/core` returns a **predicate** — "earned the Crewed Up sticker",
   * "landed Bunny Hop" — and the screen supplies the subject, as `/crew` does.
   * Home rendered the line alone, so three headless fragments sat under a
   * heading saying "Your crew" with a 32px avatar the only clue to whose. No
   * test read a line, which is exactly how it got through.
   *
   * So this reads one: the rider's own name, then a lower-case predicate after
   * it. The lower case is the second half of the fix — `.cond` uppercased these
   * sentences where `/crew` draws them in body type, and one feed in two voices
   * is one feed to learn twice.
   */
  await arriveAtHome(page, 'Wren Halloway');

  // A crew of one is still a crew, and its owner's own activity is in its feed.
  await page.goto('/crew');
  await page.getByLabel('What is it called?').fill('Ramp Rats');
  await page.getByRole('button', { name: 'Start it' }).click();
  await expect(page.getByText('Ramp Rats').first()).toBeVisible();

  // Something to have a line about.
  await page.goto('/library');
  await page.locator('.tcard').first().click();
  await page.waitForURL(/\/library\/.+/);
  await expect(async () => {
    await page.getByRole('button', { name: 'Sometimes' }).click();
    await expect(page.getByRole('button', { name: 'Sometimes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }).toPass({ timeout: 20_000 });
  await expect(page.locator('.toast').first()).toBeVisible();

  await page.goto('/home');
  const crew = page.getByRole('main').locator('section', { hasText: 'Your crew' });
  const line = crew.locator('p').first();
  await expect(line).toBeVisible();

  const text = (await line.innerText()).trim();
  expect(text, 'the crew line has no subject').toMatch(/^Wren\b/);
  // The predicate, and it is not shouted.
  const predicate = text.slice('Wren'.length).trim();
  expect(predicate.length, 'the crew line is a name and nothing else').toBeGreaterThan(0);
  expect(predicate, 'the crew line is drawn in caps').not.toBe(predicate.toUpperCase());
});

test('the sport tab row is gone from the dashboard (D5)', async ({ page }) => {
  await arriveAtHome(page, 'Chip Rider');

  /*
   * The sport is chosen once, in the top bar's chip, and every in-page sport
   * row goes with it. Home's was the first one a rider met, directly under the
   * greeting — and with one sport it was never drawn at all, so a rider who
   * added a second sport used to watch a new row appear on five screens.
   */
  await expect(page.getByRole('main').getByRole('tablist', { name: 'Sport' })).toHaveCount(0);
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

test('Home leads into the quick log, with the ride tap kept under it', async ({ page }) => {
  await arriveAtHome(page, 'Logging Rider');

  const card = page.locator('.panel', { hasText: 'Riding streak' }).first();

  /*
   * T43, and the owner's call of 2026-09-14: Home was the only screen with no
   * way into the session logger, and the session link now leads the card while
   * "I rode today" keeps its place beneath it. Both halves are asserted,
   * because either one going missing is the decision quietly reversed.
   *
   * This runs at all because the e2e server sets `LANDIT_SESSIONS_OPEN=1`
   * (`playwright.config.ts`) — sessions are otherwise owner-only (T41), and a
   * rider made during the run is not the owner.
   */
  const log = card.getByRole('link', { name: 'Log a session' });
  await expect(log).toBeVisible();
  await expect(card.getByRole('button', { name: 'I rode today' })).toBeVisible();

  // The quick log, not the full form: three taps is what a dashboard button
  // should cost.
  await expect(log).toHaveAttribute('href', '/progress/sessions/new?quick=1');

  await log.click();
  await page.waitForURL('**/progress/sessions/new?quick=1');
  await expect(page.getByText('Rode just now')).toBeVisible();
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

test('the crew panel says what is true rather than showing demo data', async ({ page }) => {
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

/*
 * "Your tricks" holds every trick the rider tracks, learning first (Rachid,
 * 2026-09-18, in chat).
 *
 * **The order is unit-tested and this is not a second copy of that.**
 * `trackedTricksForDashboard` in `@landit/core` decides the sequence and
 * `library.test.ts` proves it. What only a browser can show is that the screen
 * *asks* it — the grid held the `trying` slice for weeks while the heading said
 * "Your tricks" and the link said "All 3 of yours", and nothing failed, because
 * every count on the dashboard was right and only the cards under them were
 * wrong. So this asserts the one thing that disagreed: the number in the link
 * and the number of cards are the same number.
 */
async function stageTrick(page: Page, slug: string, label: string): Promise<void> {
  await page.goto(`/library/${slug}`);
  await page.getByRole('button', { name: label, exact: true }).click();
  // The toast, not the optimistic note beside the picker: only the toast means
  // the server action came back (issues #64, #72, and LESSONS §1).
  await expect(page.locator('.toast', { hasText: /Logged as/i }).first()).toBeVisible();
}

test('“Your tricks” shows the landed ones too, and its link counts what it shows', async ({
  page,
}) => {
  await arriveAtHome(page, 'Tracked Rider');

  const free = scooterTricks.filter((t) => !isTrickLocked(t, 'rookie')).slice(0, 3);
  // Two landed and one being learned — the rider who used to be shown a single
  // card over a link promising three.
  await stageTrick(page, free[0]!.id, 'Sometimes');
  await stageTrick(page, free[1]!.id, 'Most times');
  await stageTrick(page, free[2]!.id, 'Learning');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/home');

  await expect(page.getByRole('button', { name: 'All 3 of yours →' })).toBeVisible();
  const cards = page.locator('.grid-tricks .tcard');
  await expect(cards).toHaveCount(3);

  // Learning first, then the ordinary stage order — the landed pair follow it
  // rather than being dropped.
  await expect(cards.nth(0)).toContainText(free[2]!.name, { ignoreCase: true });
  await expect(cards.nth(0)).toContainText('Learning');
  await expect(cards.nth(1)).toContainText(free[0]!.name, { ignoreCase: true });
  await expect(cards.nth(2)).toContainText(free[1]!.name, { ignoreCase: true });

  /*
   * And every one of them carries its stage row, which is what makes a bump
   * move a card down the grid rather than out of it (#190). A landed card with
   * no row would leave the rider back on the trick page to correct a stage.
   */
  for (const i of [0, 1, 2]) {
    await expect(
      page.locator('.grid-tricks > *').nth(i).getByRole('button', { name: 'Every time' }),
      `the card at ${i} has no stage row`,
    ).toBeVisible();
  }
});
