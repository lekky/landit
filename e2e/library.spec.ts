import {
  SPORTS,
  SPORT_IDS,
  TIERS_LABEL,
  TRICKS,
  crossSportEquivalents,
  isTrickLocked,
  lowdownTeaser,
  tricksFor,
} from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';

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
  await finishOnboarding(page);
  // T8 landed the dashboard, so that is where a finished onboarding goes.
  await page.waitForURL('**/home');
}

test('the library lists the tricks signed out, and the sport row is gone (D5)', async ({
  page,
}) => {
  await page.goto('/library');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('tricks');
  await expect(card(page, freeTrick.name)).toBeVisible();

  /*
   * This asserted "one tab per sport" until T52. The sport is chosen once now,
   * in the top bar's chip (D5), and every in-page sport row goes with it — this
   * was the last one on this screen. The assertion is inverted rather than
   * deleted, because the row coming back is the thing the decision forbids and
   * nothing else would notice.
   *
   * Three sports since T21, and the count is kept: it is what stops this
   * passing because `SPORT_IDS` quietly emptied.
   */
  for (const id of SPORT_IDS) {
    await expect(page.getByRole('tab', { name: new RegExp(SPORTS[id].label, 'i') })).toHaveCount(0);
  }
  expect(SPORT_IDS.length).toBe(3);

  // Signed out there is no All · Mine either: a visitor has no tracked tricks,
  // so the row would be a control with one working side.
  await expect(page.getByRole('tablist', { name: 'Which tricks to show' })).toHaveCount(0);
});

test('All · Mine · Filters is one row, and it fits a 320px phone', async ({ page }) => {
  /*
   * Issue #550's shape, on the widest of the rows: three boxes rather than two,
   * one of them carrying a count. `.tabrow .sporttab` is `flex: 1` with
   * `white-space: nowrap`, so a label that will not fit makes its box refuse to
   * shrink and the whole document scrolls sideways — which on this screen would
   * also take the card grid with it.
   *
   * 320 is the narrowest phone the product is built for, and it is the width
   * `TabRow`'s own tightening (`.rowFit`, under 420px) exists for.
   */
  await page.setViewportSize({ width: 320, height: 844 });
  await signUpRookie(page);
  await page.goto('/library');

  const tabs = page.getByRole('tablist', { name: 'Which tricks to show' });
  await expect(tabs.getByRole('tab')).toHaveCount(2);
  const filters = page.getByRole('button', { name: /Filters/ });
  await expect(filters).toBeVisible();

  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(
      overflow,
      `the document is ${overflow}px wider than the screen at ${width}`,
    ).toBeLessThanOrEqual(0);
  }

  // Every box in the row is a 44px target (§4), the Filters one included.
  for (const box of [tabs.getByRole('tab').first(), tabs.getByRole('tab').last(), filters]) {
    const size = await box.boundingBox();
    expect(size?.height).toBeGreaterThanOrEqual(44);
  }

  // And the third box is a disclosure rather than a tab — a screen reader told
  // "Filters, tab" would expect the panel under the row to become the filters.
  await expect(filters).toHaveAttribute('aria-expanded', 'false');
  await filters.click();
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Park', exact: true })).toBeVisible();
});

test('Mine is a tab of that row, and still rewrites the address', async ({ page }) => {
  await signUpRookie(page);
  await page.goto('/library');

  const tabs = page.getByRole('tablist', { name: 'Which tricks to show' });
  await expect(tabs.getByRole('tab', { name: /^All/ })).toHaveAttribute('aria-selected', 'true');

  await tabs.getByRole('tab', { name: /^Mine/ }).click();
  await expect(page).toHaveURL(/mine=1/);
  await expect(page.getByText('You are not tracking anything yet')).toBeVisible();

  await tabs.getByRole('tab', { name: /^All/ }).click();
  await expect(page).not.toHaveURL(/mine=1/);
  await expect(card(page, freeTrick.name)).toBeVisible();
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
  // Not a tier list any more: the free tier is a hand-picked twenty per sport,
  // not everything below a line (issue #286, `PLANS` in `@landit/core`). What
  // the banner owes a rider is the shape of what they have and where the rest
  // is, and this asserts both halves of that sentence.
  await expect(page.getByText('Twenty hand-picked tricks in every sport are yours')).toBeVisible();
  await expect(page.getByText('The rest of the library opens up on Shredder')).toBeVisible();

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
  // "This one", not "{tier} tier": a locked trick's tier says nothing about
  // whether its neighbours are locked, because the free tier is a spread and
  // not a line (issue #286).
  await expect(page.getByText('This one is on Shredder')).toBeVisible();

  /*
   * The lowdown **opens** rather than being withheld (2026-09-16, in chat):
   * the top of it is on the page, and the rest is not. Both halves are
   * asserted, because each one on its own is a different bug — the first
   * missing is the page saying nothing about the trick it is named after, and
   * the second missing is the paywall handing over the copy it is there to
   * sell.
   */
  const teaser = lowdownTeaser(lockedTrick.about);
  const body = await page.locator('body').innerText();
  expect(body).toContain(teaser.replace(/\u2026$/, ''));
  expect(body).not.toContain(lockedTrick.about.trim().slice(-40));

  // Everything the tier is actually for is still absent: the tips, and a stage
  // picker to write with.
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

/*
 * The award badge in the hero, and the stamp that lands on it.
 *
 * Three things are being held down here. The photo placeholder — a hatched box
 * captioned "Trick photo: drop a shot of this trick" — was live to riders for a
 * fortnight after launch, so its absence is asserted rather than assumed.
 *
 * The badge's state comes from `rider_stickers`, which only the award hook can
 * write: a page that decided for itself whether a rider had earned something
 * would look identical until the day it was wrong. The accessible name is where
 * that answer surfaces, so it is what gets asserted — the stamp itself is
 * `aria-hidden`, being the same fact drawn twice.
 *
 * And the stamp lands **without a reload**. `StagePanel` refreshes the page
 * when the write says a sticker came back, which is what makes earning it a
 * moment rather than something a rider finds later; the assertion before the
 * reload is what notices if that refresh is dropped. The reload after it is
 * still worth keeping, because it is the only way to see that the row outlived
 * the request that made it.
 */
test('a trick shows its award, and landing the trick stamps it', async ({ page }) => {
  await signUpRookie(page);
  await page.goto(`/library/${freeTrick.id}`);

  await expect(page.getByRole('heading', { level: 1 })).toContainText(freeTrick.name);
  // The design pack's placeholder, gone for good.
  await expect(page.getByText(/trick photo/i)).toHaveCount(0);

  /*
   * Every trick award is named after its trick, so the badge's name is the
   * trick's — asserted from the catalogue rather than typed in.
   *
   * Since T49 the badge is in a card of its own in the row under the name (D7)
   * rather than overhanging the hero, and the card says what it takes: "Land it
   * at Sometimes" until it is held, the earned date after. "The award ·" was
   * the hero subline that card replaced.
   */
  await expect(
    page.getByRole('img', { name: `${freeTrick.name} award, not earned yet` }),
  ).toBeVisible();
  await expect(page.getByText('Land it at Sometimes')).toBeVisible();
  await expect(page.getByText('First landed')).toHaveCount(0);

  // `some` is the lowest stage that counts as landed (`LANDED_STAGES`), so
  // this is the least a rider can do and still have earned the badge.
  await page.getByRole('button', { name: 'Sometimes' }).click();
  await expect(page.locator('.toast', { hasText: /Logged as/i })).toBeVisible();

  // No reload: the refresh the earn triggers is what turns the badge over.
  await expect(page.getByRole('img', { name: `${freeTrick.name} award, earned` })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('img', { name: `${freeTrick.name} award, earned` })).toBeVisible();
  /*
   * `visible: true`, because the date is in the markup twice on purpose: as a
   * chip in the hero above the breakpoint, and under the ladder below it. Only
   * ever one of them is displayed, and `display: none` keeps the other out of
   * the accessibility tree — but both are in the DOM, and a bare `getByText`
   * matches on text rather than on visibility.
   *
   * `exact`, since T31: the history timeline under the band stars the same
   * landing as "★ first landed", and a substring match found both.
   */
  await expect(
    page.getByText('First landed', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  // And the rider's history with the trick now has a row for it (T31).
  await expect(page.getByText('★ first landed')).toBeVisible();
  await expect(page.getByText('Your history with this trick')).toBeVisible();
  // The card now dates the badge rather than telling the rider how to get it.
  await expect(page.getByText(/^Earned /)).toBeVisible();
  await expect(page.getByText('Land it at Sometimes')).toHaveCount(0);
});

/*
 * The history reads newest first (Rachid, 2026-09-13, in chat).
 *
 * It ran oldest-first from T31, which put the thing that just happened at the
 * bottom of a list that only ever grows. Asserted here rather than in a unit
 * test because this is a screen, and the order a rider actually reads is the
 * order the rows come out of the page in (`vitest.config.ts`, LESSONS §3a).
 */
test('the history puts the most recent thing first', async ({ page }) => {
  await signUpRookie(page);
  await page.goto(`/library/${freeTrick.id}`);

  /*
   * Three stages in order, so the timeline has something to get wrong.
   *
   * The ladder's buttons carry the **short** label — "Want", not "Want to
   * learn" — because five cells share a phone's width (`StagePanel`). The
   * timeline below spells them out in full, which is what the assertion reads.
   */
  for (const stage of ['Want', 'Learning', 'Sometimes'] as const) {
    await page.getByRole('button', { name: stage, exact: true }).click();
    await expect(page.locator('.toast', { hasText: /Logged as/i }).first()).toBeVisible();
    // Landing the trick earns a sticker, so a second toast can be on screen;
    // waiting for *all* of them to go is what keeps the next click landing.
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 15_000 });
  }

  await page.reload();
  // The panel is a `Panel`, which is a div — so the timeline's own rows are the
  // thing to read, and their order is the thing under test.
  const stages = page.locator('[class*="timelineStage"]');
  await expect(stages).toHaveText(['Sometimes', 'Learning', 'Want to learn']);
});

/*
 * Stopping tracking asks first, and takes only the stage with it.
 *
 * The confirm is the trick-page pack's, and it is worth a test rather than a
 * glance: this is one tap on a child's own record, and the two things it must
 * not touch — the first-landed date and the badge they earned — are exactly
 * the two the copy promises to keep.
 */
test('stopping tracking asks first, and keeps the badge', async ({ page }) => {
  await signUpRookie(page);
  await page.goto(`/library/${freeTrick.id}`);

  await page.getByRole('button', { name: 'Sometimes' }).click();
  await expect(page.locator('.toast', { hasText: /Logged as/i })).toBeVisible();

  // First press asks; it does not write.
  await page.getByRole('button', { name: 'Stop tracking' }).click();
  await expect(page.getByText(/Stop tracking this trick\?/)).toBeVisible();
  await page.getByRole('button', { name: 'Keep tracking' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sometimes' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Second time through, answered the other way.
  await page.getByRole('button', { name: 'Stop tracking' }).click();
  await page.getByRole('button', { name: 'Stop tracking' }).last().click();
  await expect(page.locator('.toast', { hasText: /Stopped tracking/i })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Sometimes' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  // The badge is still theirs — the hook never unwrites a sticker.
  await expect(page.getByRole('img', { name: `${freeTrick.name} award, earned` })).toBeVisible();
});

/*
 * The bug behind "Stop tracking doesn't seem to save all the time" (owner,
 * 2026-09-12, in chat), asserted from the outside.
 *
 * A stage write that the server *refuses* was always handled — the ladder snaps
 * back and says why. A write that never reached the server was not: the action
 * threw, so neither the revert nor the toast ran, and the band sat there
 * reading "Nothing logged yet" over a row still in the database. The rider
 * found out days later.
 *
 * This has to be a browser test. The translation itself is unit-tested in
 * `apps/web/src/lib/runAction.test.ts`, but what no unit test can reach is
 * whether the *screen* puts the stage back and says something — three pieces
 * (`runAction`, the optimistic revert, the toast) cooperating over a real
 * failed POST. And the failure mode is silence, which is exactly the shape of
 * bug that survives a green build.
 *
 * Offline is the honest way to produce it: the trick page is cacheable offline
 * (plan §2.3), so a rider at a park genuinely can be looking at this screen
 * with no route to anywhere, and Server Function queueing is deliberately off.
 */
test('a stop-tracking that never reaches the server says so, and does not lie about the stage', async ({
  page,
}) => {
  await signUpRookie(page);
  await page.goto(`/library/${freeTrick.id}`);
  /*
   * Everything here is a press on a hydrated page, and the test then takes the
   * network away. A press that lands before hydration is swallowed, and with
   * the network already gone the chunks that would have finished the job never
   * arrive — so the failure comes back as "no toast" or "no confirm", three
   * steps from the cause. Waiting for the page to go quiet once, here, is what
   * makes the rest of it mean what it says.
   */
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Sometimes' }).click();
  await expect(page.locator('.toast', { hasText: /Logged as/i })).toBeVisible();
  /*
   * And then let it go before pressing anything else.
   *
   * The toast stack is fixed at the bottom centre, and since T49 put the
   * sticker-and-video row between the hero and the band, the band is below the
   * fold on a 1280 × 720 window — which is the window this suite runs in. So
   * the two overlap, Playwright scrolls the button into view, and the click
   * lands on the toast instead: "locator.click: Test timeout exceeded", about
   * a third of the time. Waiting the 3.2s out is what makes the press a press.
   */
  await expect(page.locator('.toast')).toHaveCount(0);

  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Stop tracking' }).click();
  /*
   * Wait for the confirm's own sentence before pressing again.
   *
   * Asking for the confirm rather than for a second button is what makes this
   * stable: pressing the first one moves the actions out of the ladder's row
   * and into the foot, so the old pair is detached and a new pair is mounted,
   * and `.last()` on its own resolved to the button on its way out about a
   * third of the time — "element was detached from the DOM, retrying", then the
   * test's whole clock. Measured on this branch and on `shell-rethink` before
   * it, so the flake predates T49; it is fixed here because the file was open.
   */
  await expect(page.getByText(/Stop tracking this trick\?/)).toBeVisible();
  await page.getByRole('button', { name: 'Stop tracking' }).last().click();

  /*
   * The two halves of the fix, and the test fails on either.
   *
   * `/did not save/` rather than the exact sentence: which of the two wordings
   * appears depends on `navigator.onLine`, and Chromium under Playwright's
   * offline emulation reports itself online (see `offline.spec.ts`). Both
   * sentences carry this phrase, and it is the part that matters — the rider is
   * told the write did not happen.
   */
  await expect(page.locator('.toast', { hasText: /did not save/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sometimes' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // And the server agrees with the screen, which is the whole point: before the
  // fix these two disagreed, and only the reload ever revealed it.
  await page.context().setOffline(false);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sometimes' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
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

/*
 * T32: what the page says from T28's content and T29's glossary. Named tricks
 * rather than picked ones, because the assertions are about copy those two
 * tricks are known to carry — the Tailwhip's four mistakes and the Bunny Hop's
 * two equivalents — and both are free, so a visitor sees the whole page.
 */
const tailwhip = TRICKS.find((t) => t.id === 'tailwhip')!;

test('a trick says why it is not working, one numbered row per mistake', async ({ page }) => {
  await page.goto('/library/tailwhip');

  // Four today; the number comes from the catalogue so a content edit moves
  // the test rather than breaking it, and the section sits under the Tips.
  expect(tailwhip.mistakes).toHaveLength(4);
  await expect(page.getByRole('heading', { name: "Why it isn't working" })).toBeVisible();
  const rows = page.getByRole('list', { name: "Why it isn't working" }).getByRole('listitem');
  await expect(rows).toHaveCount(tailwhip.mistakes!.length);
  for (const [index, mistake] of tailwhip.mistakes!.entries()) {
    await expect(rows.nth(index)).toContainText(String(index + 1));
    await expect(rows.nth(index)).toContainText(mistake.what);
    await expect(rows.nth(index)).toContainText(mistake.fix);
  }

  // And the sentence under the facts strip says why it is this tier.
  await expect(page.getByText(`Why it's ${TIERS_LABEL[tailwhip.diff - 1]}:`)).toBeVisible();
  await expect(page.getByText(tailwhip.hard!)).toBeVisible();
});

test('a trick names the same movement in the other sports, as links', async ({ page }) => {
  await page.goto('/library/bunny-hop');

  const equivalents = crossSportEquivalents('bunny-hop');
  expect(equivalents.map((t) => t.id)).toEqual(['sk-ollie', 'bmx-bunny-hop']);

  const list = page.getByRole('list', { name: 'Same trick, other sports' });
  await expect(list).toBeVisible();
  await expect(list.getByRole('listitem')).toHaveCount(equivalents.length);
  await expect(list.getByRole('link', { name: 'Ollie' })).toHaveAttribute(
    'href',
    '/library/sk-ollie',
  );
  await expect(list.getByRole('listitem').first()).toContainText('Skateboard');
  await expect(list.getByRole('link', { name: 'Bunny Hop' })).toHaveAttribute(
    'href',
    '/library/bmx-bunny-hop',
  );

  // Following one lands on the other sport's page, not a 404.
  await list.getByRole('link', { name: 'Ollie' }).click();
  await expect(page).toHaveURL(/\/library\/sk-ollie$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ollie');
});

test('a dotted word in the tips opens the glossary, with the way back', async ({ page }) => {
  await page.goto('/library/tailwhip');

  // The Tips paragraph, found by its own copy, and the first glossary word in
  // it. Which word is the glossary rule's business (`glossarySegments`); this
  // asserts that the page wired the rule to the copy and drew it as agreed.
  const tips = page
    .locator('p', { has: page.locator('a[href^="/glossary?from=tailwhip#"]') })
    .filter({ hasText: tailwhip.tips.slice(0, 24) });
  await expect(tips).toHaveCount(1);
  const word = tips.locator('a[href^="/glossary?from=tailwhip#"]').first();
  const href = await word.getAttribute('href');
  expect(href).toMatch(/^\/glossary\?from=tailwhip#[a-z0-9-]+$/);

  // A 2px dotted ink underline and nothing else: the word keeps the
  // paragraph's colour (handoff, "Decisions to confirm").
  await expect(word).toHaveCSS('text-decoration-style', 'dotted');
  // Through the element's own window: this tsconfig has no DOM lib, so
  // `getComputedStyle` is not a name here (the same note as `profile.spec.ts`).
  const proseColour = await tips.evaluate(
    (el) => el.ownerDocument.defaultView!.getComputedStyle(el).color,
  );
  await expect(word).toHaveCSS('color', proseColour);

  await word.click();
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[?#]/g, '\\$&')}$`));
  const back = page.getByRole('link', { name: 'Back to the trick' });
  await expect(back).toHaveAttribute('href', '/library/tailwhip');
  await back.click();
  await expect(page).toHaveURL(/\/library\/tailwhip$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(tailwhip.name);
});

/*
 * Your place in the grid, kept for the hop into a trick page and back.
 *
 * This is the one behaviour in the file that no unit test can reach and no
 * screenshot can show. `apps/web/src/lib/libraryPlace.test.ts` proves the
 * memory's own rules, but whether a rider lands where they left depends on
 * three things only a browser has: when React unmounts the grid, when Next
 * scrolls a new page to the top, and how tall the document is at the moment the
 * browser makes its own attempt at a Back. Any of those can change under a Next
 * upgrade without a line of this repository changing, and the failure is
 * silent — the library still works, it just quietly stops remembering.
 *
 * Three tests, because the promise has three parts: the offset comes back, the
 * narrowing that produced it comes back with it, and it is a promise about one
 * hop rather than a standing preference.
 */

/**
 * Scroll to the foot of the page and answer with the offset that reached.
 *
 * Read off `<html>` rather than out of `window.scrollY`, which is the same
 * number and not a name this tsconfig has: the e2e `lib` is ES2023 with no DOM,
 * so the types come from the element handle (`shell.spec.ts` scrolls the same
 * way).
 */
async function toTheBottom(page: Page): Promise<number> {
  return page.locator('html').evaluate((el) => {
    el.scrollTo(0, el.scrollHeight);
    return el.scrollTop;
  });
}

const offset = (page: Page) => page.locator('html').evaluate((el) => el.scrollTop);

test('the arrow out of a trick page lands back where the rider left the grid', async ({ page }) => {
  await page.goto('/library');
  await expect(card(page, freeTrick.name)).toBeVisible();

  const left = await toTheBottom(page);
  // If the whole library fitted on the screen there would be nothing to put a
  // rider back into, and this test would pass against an empty implementation.
  expect(left).toBeGreaterThan(400);

  // The URL rather than the heading: a card's name is drawn uppercase by the
  // design's own type, so `innerText` and the trick page's `h1` disagree in
  // case and nothing but the address says which trick was opened.
  await page.locator('.tcard').last().click();
  await expect(page).toHaveURL(/\/library\/[a-z0-9-]+$/);

  await page.getByRole('link', { name: 'All tricks' }).click();
  await expect(card(page, freeTrick.name)).toBeVisible();
  // `poll`, because the restore is deliberately a frame behind the render: it
  // has to outlast Next's own scroll and the browser's.
  await expect.poll(() => offset(page), { timeout: 2000 }).toBeGreaterThan(left - 4);
});

test('a browser Back brings the sort and the offset back together', async ({ page }) => {
  await page.goto('/library');

  // The sort is React state with no address, so before the place memory it was
  // gone on the way back — and an offset restored into a differently ordered
  // grid is not a place, it is a coincidence.
  await page.getByRole('button', { name: 'Hardest first' }).click();
  const cards = page.locator('.tcard');
  await expect(cards.first()).toBeVisible();
  // `textContent`, not `innerText`: the design draws a card's name uppercase, so
  // `innerText` answers with what the CSS renders and never matches the text
  // the same element holds.
  const hardestFirst = await cards.first().locator('.nm').textContent();

  const left = await toTheBottom(page);
  expect(left).toBeGreaterThan(400);
  await cards.last().click();
  /*
   * The **address**, and not `h1` — which is what this waited on until it was
   * caught, and it made the test lie. The library's own heading is an `h1`
   * ("84 tricks"), so the assertion passed against the screen the rider was
   * still on and the Back below fired mid-navigation, landing on `about:blank`.
   * The URL is the only thing here that says the trick page has arrived.
   */
  await expect(page).toHaveURL(/\/library\/[a-z0-9-]+$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('button', { name: 'Hardest first' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(cards.first().locator('.nm')).toHaveText(hardestFirst ?? '');
  await expect.poll(() => offset(page), { timeout: 2000 }).toBeGreaterThan(left - 4);
});

test('a search survives the trick page too, and the grid stays narrowed', async ({ page }) => {
  await page.goto('/library');

  await page.getByLabel('Search tricks').fill('grind');
  const narrowed = page.locator('.tcard');
  await expect(narrowed.first()).toBeVisible();
  const matches = await narrowed.count();
  expect(matches).toBeGreaterThan(0);

  await narrowed.first().click();
  // The address, for the reason the test above gives.
  await expect(page).toHaveURL(/\/library\/[a-z0-9-]+$/);
  await page.getByRole('link', { name: 'All tricks' }).click();

  await expect(page.getByLabel('Search tricks')).toHaveValue('grind');
  await expect(narrowed).toHaveCount(matches);
});

test('arriving at the library any other way starts at the top, as it always did', async ({
  page,
}) => {
  await page.goto('/library');
  const left = await toTheBottom(page);
  expect(left).toBeGreaterThan(400);

  await page.locator('.tcard').last().click();
  await expect(page).toHaveURL(/\/library\/[a-z0-9-]+$/);

  // Out of the section, then back into it through the navigation. The place is
  // kept for the hop into a trick page and nothing else: a rider who was last
  // in the library before a detour is not "coming back", and gets the plain
  // top-of-grid arrival they always got.
  const nav = page.getByRole('navigation', { name: 'Main' });
  // **Find**, not Spots: the bar carries four groups since the app shell
  // rethink (T45), and Find lands on its own "For you" summary (T48).
  await nav.getByRole('link', { name: 'Find' }).click();
  await expect(page).toHaveURL(/\/find$/);
  await nav.getByRole('link', { name: 'Tricks' }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(card(page, freeTrick.name)).toBeVisible();

  await expect.poll(() => offset(page), { timeout: 2000 }).toBeLessThan(40);
  await expect(page.getByLabel('Search tricks')).toHaveValue('');
});

/*
 * The reset, and where it is deliberately not offered (Rachid, 2026-09-13, in
 * chat).
 *
 * Stopping tracking keeps everything and is asserted above. This is the other
 * answer, for a rider who tapped a stage by accident: it deletes the trick's
 * whole history, the first-landed date and the badge, and it is the only thing
 * in the product that destroys a rider's own record. So the test is as much
 * about what guards it as what it does — it is reachable only once a rider has
 * already decided to stop, and never on a trick with no history at all.
 */
test('the reset is not offered while a trick is still tracked', async ({ page }) => {
  await signUpRookie(page);
  await page.goto(`/library/${freeTrick.id}`);

  // Nothing tracked, nothing to clear, and nowhere to clear it from.
  await expect(page.getByRole('button', { name: 'Clear history', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Sometimes' }).click();
  await expect(page.locator('.toast', { hasText: /Logged as/i })).toBeVisible();
  await expect(page.getByText('★ first landed')).toBeVisible();

  // Tracked, so there is history — and still no way to destroy it from here.
  await expect(page.getByRole('button', { name: 'Clear history', exact: true })).toHaveCount(0);

  // The stop-tracking confirm keeps its two answers and gains nothing.
  await page.getByRole('button', { name: 'Stop tracking' }).click();
  await expect(page.getByText(/Stop tracking this trick\?/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear history', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /clear/i })).toHaveCount(0);
});

test('a rider who stopped tracking can clear the history, and it takes the badge', async ({
  page,
}) => {
  await signUpRookie(page);
  await page.goto(`/library/${freeTrick.id}`);

  await page.getByRole('button', { name: 'Sometimes' }).click();
  await expect(page.locator('.toast', { hasText: /Logged as/i })).toBeVisible();
  await expect(page.getByRole('img', { name: `${freeTrick.name} award, earned` })).toBeVisible();

  await page.getByRole('button', { name: 'Stop tracking' }).click();
  await page.getByRole('button', { name: 'Stop tracking' }).last().click();
  await expect(page.locator('.toast', { hasText: /Stopped tracking/i })).toBeVisible();
  await page.reload();

  /*
   * Untracked, but the history stayed and so did the badge — which is what
   * stopping promises. The star marks the first landing in the timeline, and it
   * is the one string on this page that only a history row carries: the band's
   * "Nothing logged yet" is shared with the empty summary, so it cannot stand
   * in for this.
   */
  await expect(page.getByText('★ first landed')).toBeVisible();
  await expect(page.getByRole('img', { name: `${freeTrick.name} award, earned` })).toBeVisible();

  // The reset asks first, and backing out of it writes nothing.
  await page.getByRole('button', { name: 'Clear history', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Clear your history?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep it' }).click();
  await page.reload();
  await expect(page.getByText('★ first landed')).toBeVisible();

  // Through the confirm, and now it goes.
  await page.getByRole('button', { name: 'Clear history', exact: true }).click();
  await page.getByRole('button', { name: 'Clear it all' }).click();
  await expect(page.locator('.toast', { hasText: /History cleared/i })).toBeVisible();

  await page.reload();
  /*
   * The timeline is empty and the badge has gone — which is the difference
   * between this and stopping tracking, and what the confirm promised. The
   * panel itself stays, now reading "Nothing logged yet": it is where the rows
   * were, so it is the honest place for the sentence saying there are none. And
   * with no history left there is nothing to reset, so the button goes too.
   */
  await expect(page.getByText('★ first landed')).toHaveCount(0);
  await expect(page.getByRole('img', { name: `${freeTrick.name} award, earned` })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear history', exact: true })).toHaveCount(0);
});

/*
 * ------------------------------------------------- the trick page on layout A
 *
 * T49 (app shell rethink §3.8, D7). The page reorders: the sticker and the
 * video share one row under the name, the yellow band carries `#ladder`, and
 * every section below is an `Accordion` on a phone and a plain panel above
 * 820px. These are the assertions that notice if any of that comes apart —
 * the order is decided in CSS and in a client-side media query, and neither
 * fails loudly on its own.
 *
 * The two tricks with a tutorial are reserved by `seed-trick-video.ts` and are
 * not touched here; the row's "with a video" state is asserted in
 * `trick-video.spec.ts`, which already owns that fixture.
 */

const PHONE = { width: 390, height: 844 };

test('the desktop shares the row; the phone stacks it, video first', async ({ page }) => {
  // With no video: one card, spanning both columns of the row.
  await page.goto(`/library/${freeTrick.id}`);
  const sticker = page.locator('#sticker');
  await expect(sticker).toBeVisible();
  await expect(page.locator('#watch')).toHaveCount(0);
  const row = page.locator('#sticker').locator('xpath=..');
  const rowBox = (await row.boundingBox())!;
  const aloneBox = (await sticker.boundingBox())!;
  // Within the row's own padding — the card is the row, not half of it.
  expect(aloneBox.width).toBeGreaterThan(rowBox.width - 60);

  // With one: two cards side by side, tops level, neither the full width.
  await page.goto('/library/bmx-wheelie');
  const withVideo = (await page.locator('#sticker').boundingBox())!;
  const watch = (await page.locator('#watch').boundingBox())!;
  expect(withVideo.width).toBeLessThan(rowBox.width - watch.width);
  expect(watch.x).toBeGreaterThan(withVideo.x + withVideo.width - 1);
  expect(Math.abs(watch.y - withVideo.y)).toBeLessThan(2);

  /*
   * And the player is capped (independent review, S5). The row sits between the
   * name and the band, so an uncapped 16:10 player on a wide screen pushed the
   * only control on this page a long way below a laptop's fold: measured, the
   * band's top went from 291 on `main` to 785. A 360px track brings it to 665.
   */
  expect(watch.width).toBeLessThanOrEqual(366);

  // And the row is above the band at both widths, which is what D7 decided.
  const band = (await page.locator('#ladder').boundingBox())!;
  expect(watch.y + watch.height).toBeLessThanOrEqual(band.y + 1);
  // On a 1280 × 720 laptop the band's top is still on screen with a video on
  // the page, which is what the cap is for.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/library/bmx-wheelie');
  expect((await page.locator('#ladder').boundingBox())!.y).toBeLessThan(720);

  /*
   * **The phone stacks them, video first** (D7a, Rachid, 2026-09-17). Sharing
   * the row on a phone cost the tutorial three quarters of its area; full width
   * gives it back the size it has on `main`. The sticker card follows, under it.
   */
  await page.setViewportSize(PHONE);
  await page.goto('/library/bmx-wheelie');
  const pWatch = (await page.locator('#watch').boundingBox())!;
  const pSticker = (await page.locator('#sticker').boundingBox())!;
  expect(pWatch.y + pWatch.height).toBeLessThanOrEqual(pSticker.y + 1);
  expect(Math.abs(pWatch.x - pSticker.x)).toBeLessThan(2);
  expect(Math.abs(pWatch.width - pSticker.width)).toBeLessThan(2);
  // Full width of the row, not half of it, and comfortably bigger than the
  // 132px the two-column cut gave it.
  expect(pWatch.width).toBeGreaterThan(300);
  // Still above the band, and the band still on the first screenful at 844.
  expect(pSticker.y + pSticker.height).toBeLessThanOrEqual(
    (await page.locator('#ladder').boundingBox())!.y + 1,
  );
  expect((await page.locator('#ladder').boundingBox())!.y).toBeLessThan(844);
});

test('a section on a phone is a details that opens, and a plain panel on a desktop', async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto(`/library/${freeTrick.id}`);

  // The row is the native element, not a div wearing ARIA.
  const lowdown = page.locator('details').filter({ hasText: 'The lowdown' }).first();
  await expect(lowdown).toHaveJSProperty('tagName', 'DETAILS');
  await expect(lowdown).not.toHaveAttribute('open', '');

  const body = page.getByText(freeTrick.about.slice(0, 40));
  await expect(body).toBeHidden();

  await page.getByRole('heading', { name: 'The lowdown' }).click();
  await expect(lowdown).toHaveAttribute('open', '');
  await expect(body).toBeVisible();

  // Shutting it again is the same press, and the copy goes back behind it.
  await page.getByRole('heading', { name: 'The lowdown' }).click();
  await expect(body).toBeHidden();

  /*
   * Above 820px there is no disclosure at all (§3.8): every section is open and
   * the row is not a control — it takes no pointer, which is why this asserts
   * the state rather than clicking to prove nothing happens. The width is read
   * in the browser, so this is the state after hydration rather than the markup
   * the server sent. "Not focusable, no chevron" is its own test below.
   */
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await expect(body).toBeVisible();
  await expect(lowdown).toHaveAttribute('open', '');
  await expect(lowdown).toHaveClass(/accordion-plain/);
  await expect(lowdown.locator('summary')).toHaveCSS('pointer-events', 'none');
});

test('the Log sheet lands on the ladder and on the videos, clear of the top bar', async ({
  page,
}) => {
  await signUpRookie(page);
  await page.setViewportSize(PHONE);

  // `#ladder` — where "Log a trick" arrives. The band has to be below the
  // sticky top bar once the browser has scrolled to it, not under it.
  await page.goto(`/library/${freeTrick.id}#ladder`);
  const band = page.locator('#ladder');
  await expect(band).toBeVisible();
  const bar = (await page.locator('header.topbar').boundingBox())!;
  const bandBox = (await band.boundingBox())!;
  expect(bandBox.y).toBeGreaterThanOrEqual(bar.y + bar.height);
  // And the thing a rider came to press is in it.
  await expect(band.getByRole('button', { name: 'Sometimes' })).toBeVisible();

  /*
   * `#clips` — where "Add a clip link" arrives. A fragment that scrolled a shut
   * box into view would be a link that did not work, so the row opens itself.
   *
   * Away first, so this is a real navigation. Two `goto`s to the same path
   * differing only in the fragment are a same-document hop, and Chromium
   * applied the second one about two times in three — measured: the hash was
   * still `#ladder` a second later. That is a race in the test's own driving,
   * not in the page, and the rider's path is the one this now walks: from
   * another screen, through the Log sheet, onto the trick.
   */
  await page.goto('/library');
  await page.goto(`/library/${freeTrick.id}#clips`);
  const mine = page.locator('details#clips');
  await expect(mine).toHaveAttribute('open', '');
  await expect(page.getByRole('tab', { name: /Your videos/i })).toBeVisible();
});

test('the desktop page keeps its two columns', async ({ page }) => {
  await signUpRookie(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/library/${freeTrick.id}`);

  const lowdown = (await page.getByRole('heading', { name: 'The lowdown' }).boundingBox())!;
  const facts = (await page.getByRole('heading', { name: 'Where it sits' }).boundingBox())!;

  // Side by side, not stacked: the second column starts to the right of the
  // first and their headings sit on the same line.
  expect(facts.x).toBeGreaterThan(lowdown.x + 200);
  expect(Math.abs(facts.y - lowdown.y)).toBeLessThan(4);

  // The jump row is the phone's, and is not drawn here.
  await expect(page.getByRole('navigation', { name: 'Jump to a section' })).toBeHidden();
});

/*
 * The five the independent review of 2026-09-17 said were missing, each against
 * the finding it would have caught: S3 (the desktop summary was still a
 * control), S4 (the clip link landed on the notes tab), S2 (a fast second tap
 * finished the close instead of re-opening), S1 (a printed page was headings and
 * nothing else), and the locked page, which short-circuits before any of this
 * and should keep doing so.
 */

test('the desktop headings are headings, not controls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/library/${freeTrick.id}`);

  const head = page.locator('details.accordion').first().locator('summary');
  await expect(head).toBeVisible();

  // No chevron, and not a tab stop: §3.8 says the desktop has no disclosure in
  // it, and a keyboard rider should not meet seven stops that do nothing.
  await expect(page.locator('.accordion-chev').first()).toBeHidden();
  await expect(head).toHaveAttribute('tabindex', '-1');
  await expect(page.locator('details.accordion').first()).toHaveClass(/accordion-plain/);
});

test('"Add a clip link" lands on the videos tab, not on the notes', async ({ page }) => {
  await signUpRookie(page);
  await page.setViewportSize(PHONE);
  await page.goto('/library');
  await page.goto(`/library/${freeTrick.id}#clips`);

  await expect(page.locator('details#clips')).toHaveAttribute('open', '');
  // §3.5 item 4: the sheet promised the video-link field, so that is the tab
  // the rider arrives on.
  await expect(page.getByRole('tab', { name: /Your videos/i })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: /Session notes/i })).toHaveAttribute(
    'aria-selected',
    'false',
  );
});

test('a row shut and opened again in the same second comes back', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(`/library/${freeTrick.id}`);

  const row = page.locator('details').filter({ hasText: 'The lowdown' }).first();
  const head = page.getByRole('heading', { name: 'The lowdown' });

  await head.click();
  await expect(row).toHaveAttribute('open', '');

  /*
   * Shut, then open again inside the 200ms the close takes. Children tap fast,
   * and the first cut branched on the `open` attribute — which is still `true`
   * while the row is visibly shutting — so the second tap re-armed the close
   * and the row stayed down.
   */
  await head.click();
  await page.waitForTimeout(60);
  await head.click();
  await page.waitForTimeout(600);
  await expect(row).toHaveAttribute('open', '');
});

test('a printed trick page has its content, not just its headings', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(`/library/${freeTrick.id}`);
  await page.emulateMedia({ media: 'print' });

  /*
   * A printed page's media queries evaluate against the paper — about 816 CSS
   * px — which is below `PLAIN_ABOVE`, so the desktop rules do not save it
   * either. Without the `@media print` block in `additions.css` this comes back
   * as nine names and nothing under them.
   */
  const body = await page.locator('main').innerText();
  expect(body).toContain(freeTrick.about.slice(0, 40));
  expect(body).toContain(freeTrick.tips.slice(0, 40));
  await page.emulateMedia({ media: null });
});

test('the locked page carries none of the new markup', async ({ page }) => {
  await signUpRookie(page);
  await page.goto(`/library/${lockedTrick.id}`);

  // It short-circuits before the whole of layout A, and nothing about the
  // reorder may leak onto a page the rider has not paid for.
  await expect(page.getByRole('heading', { level: 1 })).toContainText(lockedTrick.name);
  await expect(page.locator('details.accordion')).toHaveCount(0);
  await expect(page.locator('#ladder')).toHaveCount(0);
  await expect(page.locator('#sticker')).toHaveCount(0);
  await expect(page.locator('#watch')).toHaveCount(0);
  await expect(page.locator('#clips')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Jump to a section' })).toHaveCount(0);
});
