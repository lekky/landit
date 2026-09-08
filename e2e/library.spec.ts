import {
  SPORTS,
  SPORT_IDS,
  TIERS_LABEL,
  TRICKS,
  crossSportEquivalents,
  isTrickLocked,
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
  // Not a tier list any more: the free tier is a hand-picked ten per sport,
  // not everything below a line (issue #286, `PLANS` in `@landit/core`). What
  // the banner owes a rider is the shape of what they have and where the rest
  // is, and this asserts both halves of that sentence.
  await expect(page.getByText('Ten hand-picked tricks in every sport are yours')).toBeVisible();
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

  // The trick is what is behind the paywall, so none of it is on the page: not
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

  // Every trick award is named after its trick, so the badge's name is the
  // trick's — asserted from the catalogue rather than typed in.
  await expect(page.getByText('The award')).toBeVisible();
  await expect(
    page.getByRole('img', { name: `${freeTrick.name} award, not earned yet` }),
  ).toBeVisible();
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
