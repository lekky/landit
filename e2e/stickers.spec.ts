import { AWARDS, SPORTS, TRICKS, isTrickLocked, tricksFor, type SportId } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding, pickEverySport } from './support/onboarding';

/*
 * The two browser globals the modal test reads inside `page.evaluate`. This
 * project's e2e tsconfig has no DOM lib, so they are declared narrowly, as
 * types only — the same arrangement as `spots.spec.ts`.
 */
declare const window: {
  scrollY: number;
  requestAnimationFrame(callback: () => void): number;
};

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

/**
 * A skate trick a brand-new rookie can land that puts a **skate** badge on the
 * wall: live, free, no prerequisites, and carrying a live trick award of its
 * own scoped to the sport.
 *
 * The last clause is what makes the scoping test mean anything. Landing any
 * trick also awards shared badges — First Land, and Day One inside the launch
 * window — and those sit on every wall, so a rider whose only landing awarded
 * shared badges has the same count on all three and the bug this pins would
 * pass. Read from the canonical data rather than named, so a library edit moves
 * the test instead of breaking it.
 */
const skateStarter = tricksFor('skate', TRICKS).find(
  (t) =>
    t.isLive &&
    !isTrickLocked(t, 'rookie') &&
    t.pre.length === 0 &&
    AWARDS.some((a) => a.isLive && a.kind === 'trick' && a.sport === 'skate' && a.trick === t.id),
)!;

/** The badge landing it earns — the one badge that is on skate's wall only. */
const skateBadge = AWARDS.find(
  (a) => a.isLive && a.kind === 'trick' && a.sport === 'skate' && a.trick === skateStarter.id,
)!.name;

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
  await finishOnboarding(page);
  await page.waitForURL('**/home');
}

/**
 * The same arrival, on every sport — which is what puts the top bar's chip on
 * screen at all. It is hidden for a rider who tracks one sport ("nothing below
 * two", §3.1), and one test below needs to switch it.
 */
async function arriveOnEverySport(page: Page, name: string): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(`e2e-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await pickEverySport(page);
  await finishOnboarding(page);
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

/**
 * Switch the wall to "Not yet", and be sure the switch landed.
 *
 * The wall opens on a rider's own collection the moment they hold anything
 * (T33) — and during the launch window that is *every* new account, because
 * `day-one` is granted at sign-up. The two tabs are disjoint halves, so the
 * Earned side draws nothing locked at all and a spec that wants the locked
 * half has to ask for it; without this it would assert over an empty
 * collection and pass by finding nothing, which is the failure mode this
 * file's own header warns about (LESSONS §5).
 *
 * Retried on `aria-selected` for the reason `markSometimes` gives: the control
 * is server-rendered, so it is on screen before React owns it, and a press
 * before hydration does nothing at all.
 *
 * A `tab`, not a pressed `button`, since T46: the switch is the boxed `TabRow`
 * every screen uses (§3.10), which is a `role="tablist"` of tabs. It was an
 * underline bar of toggles only because a sport tab row used to sit above it
 * and two identical rows read as one control (#379 item 5) — the sport row went
 * with D5, and so did the reason.
 */
async function showWholeWall(page: Page): Promise<void> {
  const notYet = page.getByRole('tab', { name: /^Not yet \d+$/ });
  await expect(async () => {
    await notYet.click();
    await expect(notYet).toHaveAttribute('aria-selected', 'true');
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

test('the wall is under Home, and has one tab row rather than two (T46)', async ({ page }) => {
  await arrive(page, 'Walled Rider');
  await page.goto('/stickers');

  // §2.3: a Home back link, and a real link rather than `history.back()`.
  const back = page.getByRole('main').getByRole('link', { name: 'Home' }).first();
  await expect(back).toHaveAttribute('href', '/home');

  /*
   * D5: the sport row goes. It used to sit above the heading, and the Earned /
   * Not yet switch was drawn as an underline bar inside the ink panel purely to
   * avoid reading as a second copy of it (#379 item 5). With the sport row gone
   * the switch is the boxed row every other screen uses, in the header, and
   * there is exactly one tab row on the page.
   */
  await expect(page.getByRole('main').getByRole('tablist')).toHaveCount(1);
  const tabs = page.getByRole('tablist', { name: 'Which badges to show' });
  await expect(tabs.getByRole('tab')).toHaveCount(2);
  // The counts came with it: "Not yet 109" is a reason to press, "Not yet" is a
  // word.
  await expect(tabs.getByRole('tab', { name: /^Earned \d+$/ })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: /^Not yet \d+$/ })).toBeVisible();

  /*
   * And a panel for them to control. A screen reader told "Earned, tab, 1 of 2"
   * and then told about no panel at all is half a pattern — the wall had the
   * tablist and not the tabpanel, which is the half a `role="tablist"` count
   * would never have caught.
   */
  const panel = page.getByRole('tabpanel');
  await expect(panel).toHaveCount(1);
  await expect(panel).toHaveAttribute('aria-label', /^(Earned|Not yet)$/);

  /*
   * And the two of them fit, down to 320px. `.tabrow .sporttab` is `flex: 1`
   * and `white-space: nowrap` (§3.3), so a row that does not fit grows past its
   * share and pushes the whole document sideways rather than wrapping — which
   * is what the three-tab row on Progress did before it was tightened. Two
   * tabs carrying three-digit counts is the case worth measuring here.
   */
  for (const width of [430, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/stickers');
    await expect
      .poll(() => page.locator('html').evaluate((el) => el.scrollWidth - el.clientWidth), {
        message: `the wall scrolls sideways at ${width}px`,
      })
      .toBe(0);
  }
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

  // A rider who signed up during the launch window (on or before 2026-12-31) holds
  // `day-one` from their first second — deliberately, T24's founder badge. A
  // rider after it holds nothing. Either way: at most one earned, the heading
  // agrees with the badges, and the wall is otherwise locked.
  const earned = Number(count.split(' of ')[0]);
  expect(earned).toBeLessThanOrEqual(1);

  // The earned tab's own count agrees with the heading.
  await expect(page.getByRole('tab', { name: `Earned ${earned}` })).toBeVisible();

  // The locked half lives behind "Not yet" now; the heading above still counts
  // the whole wall either way. The halves are disjoint, so that side holds
  // nothing but locked badges.
  await showWholeWall(page);
  await expect(page.locator('.sticker.locked').first()).toBeVisible();
  await expect(page.locator('.sticker:not(.locked)')).toHaveCount(0);
});

test('the two tabs are disjoint halves, shelved the same way, and visibly differ', async ({
  page,
}) => {
  await arrive(page, 'Tabbed Rider');
  await landSomething(page);
  await page.goto('/stickers');

  // Something earned, so the wall opens on Earned — and because the halves are
  // disjoint, nothing locked is drawn there at all. This is also what protects
  // the once-only pop: the wall acknowledges fresh awards on mount whatever
  // view is showing, so the default has to be the view that draws them.
  const earnedTab = page.getByRole('tab', { name: /^Earned \d+$/ });
  await expect(earnedTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.sticker.locked')).toHaveCount(0);

  /*
   * The regression this test exists for. T33 first shipped Earned as a shelf
   * pinned to the top of *both* views, so the first screenful was identical on
   * either tab and pressing the switch looked like it did nothing (owner, on
   * the live site, 2026-09-12). The fix is that the halves share no badge, so
   * that is what this asserts directly.
   *
   * The badge's accessible name is on its `<img>` ("<name> sticker, earned"),
   * not on the button around it.
   */
  const badgeNames = async (): Promise<(string | null)[]> => {
    const imgs = await page.locator('.sticker img').all();
    return Promise.all(imgs.map((img) => img.getAttribute('alt')));
  };

  const onEarned = await badgeNames();
  expect(onEarned.length).toBeGreaterThan(0);

  await showWholeWall(page);
  await expect(earnedTab).toHaveAttribute('aria-selected', 'false');

  const onNotYet = await badgeNames();
  expect(onNotYet.length).toBeGreaterThan(0);
  expect(
    onNotYet.filter((name) => onEarned.includes(name)),
    'a badge is on both tabs',
  ).toEqual([]);

  // Nothing earned appears on the Not yet side — disjoint, not merely reordered.
  await expect(page.locator('.sticker:not(.locked)')).toHaveCount(0);

  // Both sides use the same shelves, and each is capped, so the trick shelf
  // shows six of its many rather than swallowing the wall. Its heading still
  // says how many there are.
  const tricks = page.locator('section', {
    has: page.getByRole('heading', { name: 'Trick awards' }),
  });
  const total = Number((await tricks.getByRole('heading').innerText()).replace(/\D+/g, ''));
  expect(total).toBeGreaterThan(6);
  await expect(tricks.locator('.sticker')).toHaveCount(6);

  // And the rest are one press away, in place.
  await tricks.getByRole('button', { name: `Show all ${total} Trick awards` }).click();
  await expect(tricks.locator('.sticker')).toHaveCount(total);
  await expect(tricks.getByRole('button', { name: /^Show all/ })).toHaveCount(0);
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
  await showWholeWall(page);

  await page.locator('.sticker.locked').first().click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByText('Still locked')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Share it' })).toHaveCount(0);
});

/*
 * Issue #372, through the modal a rider opens most: the shared `Modal` on a
 * phone. Before it, a scroll on the sticker detail moved the wall behind it
 * (200 to 600 to 1000 in the audit), focus stayed on the sticker under the
 * scrim, and closing the modal put focus on the skip link.
 *
 * Where the page has got to is read off the sticker's own box rather than
 * `window.scrollY`, for the reason `spots.spec.ts` gives: the lock takes the
 * body out of flow, so `scrollY` reads 0 while the modal is up whether the page
 * is held or has run back to the top. A box on screen cannot be fooled either
 * way. `scrollY` is the right probe only after the modal has gone, which is
 * where it is used.
 */
test('the sticker detail holds the wall still behind it, takes focus, and gives it back', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await arrive(page, 'Hold Rider');
  await page.goto('/stickers');
  // The whole wall, so there is a page long enough to have a scroll position
  // worth keeping: Earned holds at most the founder badge for this rider.
  await showWholeWall(page);

  const settle = () =>
    page.evaluate(
      () =>
        new Promise((done) =>
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => done(null))),
        ),
    );

  /*
   * A sticker at the foot of the wall, so there is a position worth keeping.
   * Scoped out of the dialog on purpose: the detail modal draws the same badge,
   * later in the document, and a bare `.sticker` `.last()` re-resolves to *that*
   * one the moment the modal opens — which reads as the page jumping 200px.
   */
  const sticker = page.locator('.sticker:not([role="dialog"] .sticker)').last();
  await sticker.scrollIntoViewIfNeeded();
  await settle();
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(0);
  const stickerTop = async () => Math.round((await sticker.boundingBox())!.y);
  const where = await stickerTop();

  await sticker.click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();

  // The point of the fix first: a wheel on the panel, then on the scrim's
  // gutter beside it, moves nothing behind.
  const box = (await modal.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 600);
  await settle();
  await page.mouse.move(8, 400);
  await page.mouse.wheel(0, 600);
  await settle();
  expect(await stickerTop(), 'the wall moved behind the open modal').toBe(where);

  // Focus moved into the dialog rather than staying on the sticker behind it.
  await expect(modal).toBeFocused();

  // The page behind is out of reach: inert, so neither Tab nor a screen reader
  // can wander into it, and Tab from the dialog lands on the dialog's own Close.
  expect(await sticker.evaluate((el) => el.closest('[inert]') !== null)).toBe(true);
  await expect(page.locator('.skiplink')).toHaveAttribute('inert', '');
  await page.keyboard.press('Tab');
  await expect(modal.getByRole('button', { name: 'Close' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);

  // Back where the rider was, on the sticker they opened, with the page live.
  await expect(sticker).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
  expect(await stickerTop()).toBe(where);
  expect(await sticker.evaluate((el) => el.closest('[inert]') === null)).toBe(true);
});

test('the wall promises no posted vinyl and no Crew Pass (plan §2.4)', async ({ page }) => {
  await arrive(page, 'Copy Rider');
  await page.goto('/stickers');
  // Read the whole wall, not the Earned view — an absence proved over the
  // handful of badges a new rider holds is an absence proved over nothing.
  await showWholeWall(page);

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
  await showWholeWall(page);

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
  // a chip in the hero above the breakpoint, under the ladder below it. `exact`:
  // the history timeline (T31) marks its landed entry '★ first landed', which a
  // loose match would also find.
  const panel = page.locator('.panel', { hasText: 'First landed' }).first();
  await expect(
    panel.getByText('First landed', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await panel.getByRole('button', { name: 'Share it' }).click();

  const card = page.getByRole('dialog');
  await expect(card.getByText(`Landed the ${name}`, { exact: false }).first()).toBeVisible();
  await expect(card.getByText(/Tracked on Land The Trick\./)).toBeVisible();
  await expect(card).not.toContainText(/\d+ days? streak/i);
});

/**
 * Switch the top bar's sport chip, and be sure the switch landed.
 *
 * The chip is a button holding React state and opening a sheet, so the press is
 * retried for the reason `markSometimes` gives. `aria-label` is "Riding: Skate.
 * Switch sport." — which is also the assertion that the choice took.
 */
async function switchSport(page: Page, id: SportId): Promise<void> {
  const chip = page.getByRole('button', { name: /^Riding: / });
  // The rows carry the sport's full name and the chip its short one, which is
  // §3.1's own distinction. Waited on rather than the panel around them,
  // because the chip opens a `Sheet` on a phone and a `Dropdown` on a desktop
  // and this helper is about the choice rather than about either shape.
  const row = page.getByRole('button', { name: new RegExp(`^${SPORTS[id].label}`) });

  await expect(async () => {
    await chip.click();
    await expect(row).toBeVisible();
  }).toPass({ timeout: 20_000 });

  await row.click();
  await expect(chip).toHaveAccessibleName(new RegExp(`^Riding: ${SPORTS[id].short}`));
}

/**
 * The first number of the wall's "N of M" heading, once the wall is on the
 * sport the chip is on.
 *
 * **The eyebrow is the wait, and it is not decoration.** Which sport's wall is
 * drawn comes from `useSport()`, a client provider, so the server renders the
 * first sport and hydration swaps it — and "N of M" is true of both, so a read
 * taken straight after `goto` is a coin toss between two real numbers.
 * Measured: the skate wall answered with the scooter one, twice out of two
 * (LESSONS §5 — an assertion both screens satisfy is not a wait).
 */
async function earnedOnTheWall(page: Page, id: SportId): Promise<number> {
  await page.goto('/stickers');
  await expect(page.getByText(`Sticker wall · ${SPORTS[id].label} and shared`)).toBeVisible();
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText(/^\d+ of \d+$/);
  return Number(/^(\d+) of/.exec((await heading.textContent()) ?? '')?.[1]);
}

/**
 * The Stickers card's big number on Home, once Home is on the chip's sport.
 *
 * The library bar names the sport and is the same `SportView` the card comes
 * from, so it is the wait for the same reason the wall's eyebrow is.
 */
async function cardCount(page: Page, id: SportId): Promise<number> {
  await page.goto('/home');
  await expect(page.getByText(`${SPORTS[id].label} library`)).toBeVisible();
  const card = page.getByRole('main').getByRole('link', { name: /^Stickers/ });
  await expect(card).toBeVisible();
  return Number(/(\d+)/.exec((await card.innerText()).replace(/\s+/g, ' '))?.[1]);
}

/** The Stickers card's sub-line — "Newest: …", or "None yet". */
async function cardSub(page: Page, id: SportId): Promise<string> {
  await page.goto('/home');
  await expect(page.getByText(`${SPORTS[id].label} library`)).toBeVisible();
  const card = page.getByRole('main').getByRole('link', { name: /^Stickers/ });
  await expect(card).toBeVisible();
  return (await card.innerText()).replace(/\s+/g, ' ').trim();
}

/**
 * Home's Stickers card follows the chip (integration review, F2).
 *
 * The card's count was every sticker on every wall and its "Newest:" was the
 * newest of all of them — both sitting in a `SportView`, whose whole contract is
 * "everything that changes when the rider switches sport". So a rider who earned
 * a skate sticker and chipped back to scooter was told "1 · Newest: <a skate
 * badge>" and then opened an empty scooter wall.
 *
 * The invariant is the card matching **the wall it opens**, at whichever sport
 * the chip is on — not a hard-coded number, because how many stickers one
 * landing awards belongs to the award rules and the seeded catalogue.
 */
test('the Stickers card counts the wall it opens, and names a badge that is on it', async ({
  page,
}) => {
  await arriveOnEverySport(page, 'Scoped Rider');

  /*
   * Earn something on skate, and only on skate.
   *
   * The trick is named from the canonical data and opened by address rather
   * than browsed to: this test is about which wall a number belongs to, and
   * walking a grid to find a skate card would make it about the library's scope
   * control as well.
   */
  await switchSport(page, 'skate');
  await page.goto(`/library/${skateStarter.id}`);
  await markSometimes(page);
  await expect(page.locator('.toast', { hasText: 'Logged as sometimes' })).toBeVisible();

  const skateCard = await cardCount(page, 'skate');
  const skateWall = await earnedOnTheWall(page, 'skate');
  expect(skateCard).toBe(skateWall);

  // Back to a sport with nothing landed in it. The wall is shared badges only,
  // and the card has to say the same.
  await switchSport(page, 'scooter');
  const scooterCard = await cardCount(page, 'scooter');
  const scooterWall = await earnedOnTheWall(page, 'scooter');
  expect(scooterCard).toBe(scooterWall);

  /*
   * And the two differ, which is what makes the two assertions above mean
   * something: a card still reading the whole collection would match on one
   * sport by luck and never on both.
   */
  expect(skateCard).toBeGreaterThan(scooterCard);

  /*
   * The name, too. "Newest:" was the newest badge the rider held anywhere, so
   * the scooter card could name a skate one — a sentence about a wall that is
   * one tap away and does not contain it.
   */
  const scooterSub = await cardSub(page, 'scooter');
  // Not the skate badge, which is the wrong-wall case in its plainest form.
  expect(scooterSub).not.toContain(skateBadge);

  /*
   * And, whichever badge it does name, that badge is **on the wall the card
   * opens**. This is the assertion that does not depend on which of several
   * badges a landing awarded last: the card offers a name, and the wall behind
   * the card has to be able to show it. A badge carries its name only to a
   * screen reader — the art is the art — so it is found by its role.
   */
  const named = /Newest: (.+)$/.exec(scooterSub)?.[1]?.trim();
  expect(named, `the card said "${scooterSub}"`).toBeTruthy();

  await page.goto('/stickers');
  await expect(page.getByText(`Sticker wall · ${SPORTS.scooter.label} and shared`)).toBeVisible();
  await expect(
    page.getByRole('tabpanel').getByRole('img', { name: `${named} sticker, earned` }),
  ).toBeVisible();
});

/**
 * The sticker shelf on the tricks page (Rachid, 2026-09-18, in chat).
 *
 * **What only this can observe**: that the flag is counting the right thing.
 * The obvious implementation reads `rider_stickers.seen_at`, and every unit
 * test of *that* would pass — but the toast on the trick page stamps it seconds
 * after the award, so the flag would be blank by the time a rider reached the
 * library. That is the defect the new `users.stickers_seen_at` exists to avoid,
 * and it is only visible in a browser that has walked the whole path: land a
 * trick, be told, go to the tricks page, and still be shown there is something
 * to go and look at.
 */
test('the library shelf flags stickers the rider has not been to look at, and the wall clears it', async ({
  page,
}) => {
  await arrive(page, 'Shelf Rider');
  await landSomething(page);

  // The toast has already announced these — `rider_stickers.seen_at` is
  // stamped. The flag has to survive that, because the rider still has not
  // been to the wall.
  await page.goto('/library');
  const shelf = page.getByRole('link', { name: /^Your stickers:/ });
  await expect(shelf).toBeVisible();
  await expect(shelf).toContainText(/\d+ new/);

  // The count in the accessible name says the same thing the pink flag does.
  await expect(shelf).toHaveAccessibleName(/\d+ earned, \d+ you have not seen/);

  // Going and looking is what clears it.
  await shelf.click();
  await page.waitForURL('**/stickers');
  await expect(page.getByText('Sticker wall')).toBeVisible();

  /*
   * The stamp is written by a server action the wall fires on arrival, so it
   * lands a beat after the page does — which is the real behaviour, not a test
   * artefact: a rider who bounced straight back would see the flag once more.
   * Retried rather than slept on, the same shape `markSometimes` uses above.
   */
  await expect(async () => {
    await page.goto('/library');
    const cleared = page.getByRole('link', { name: /^Your stickers:/ });
    await expect(cleared).toBeVisible();
    await expect(cleared).not.toContainText(/\d+ new/);
    await expect(cleared).toHaveAccessibleName(/\d+ earned$/);
  }).toPass({ timeout: 20_000 });
});

test('the shelf counts the wall it opens, not every sticker the rider holds', async ({ page }) => {
  await arriveOnEverySport(page, 'Shelf Scope Rider');

  // Earned on skate, and only on skate — the same fixture the Stickers card's
  // scoping test uses, and for the same reason: a shared badge would sit on
  // every wall and the wrong-scope bug would pass.
  await switchSport(page, 'skate');
  await page.goto(`/library/${skateStarter.id}`);
  await markSometimes(page);
  await expect(page.locator('.toast', { hasText: 'Logged as sometimes' })).toBeVisible();

  /*
   * The shelf follows the top bar's chip, which is client state restored after
   * hydration — so the first paint of a fresh navigation can still be the
   * previous sport's. Waiting on the heading's own eyebrow naming the sport is
   * how `cardCount` above waits for the same thing, and for the same reason.
   */
  const shelfCount = async (id: SportId): Promise<number> => {
    await page.goto('/library');
    await expect(page.getByText(`${SPORTS[id].label} library`)).toBeVisible();
    const name = await page
      .getByRole('link', { name: /^Your stickers:/ })
      .getAttribute('aria-label');
    return Number(/(\d+) earned/.exec(name ?? '')?.[1] ?? '-1');
  };

  const skate = await shelfCount('skate');
  await switchSport(page, 'scooter');
  const scooter = await shelfCount('scooter');

  // Both walls hold the shared badges; only skate holds the trick badge. A
  // shelf counting the whole collection would give the same number twice.
  expect(skate).toBeGreaterThan(scooter);

  // And the number is the wall's own, so the wall agrees with it.
  expect(scooter).toBe(await earnedOnTheWall(page, 'scooter'));
});
