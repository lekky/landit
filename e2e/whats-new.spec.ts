import { SPORT_IDS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';
import { e2eSuperuser } from './support/seed-library';

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

  /*
   * The tab row's own **panel** (integration review, F8).
   *
   * The row declared `role="tab"` over content with no role on it, so a screen
   * reader was told "You, tab, 1 of 2" and then about no panel at all — which
   * is the one thing a tab promises. It is named by its tab rather than by a
   * copy of its words, which is ARIA's pattern and a name that cannot drift
   * from the crew's.
   */
  await expect(page.getByRole('tabpanel', { name: crewName })).toBeVisible();

  /*
   * And the tab is in `?tab=` (integration review, F8).
   *
   * The page **read** the param — the desktop dropdown's "All →" writes one —
   * and never wrote one, so a rider who pressed a crew tab and then opened a
   * rider's profile came back to You. Every other tab row that switches a panel
   * in place keeps its answer in the address (`useTabParam`, T46).
   */
  await expect(page).toHaveURL(/\/whats-new\?tab=/);
  await page.reload();
  await expect(
    page.getByRole('tablist', { name: 'What’s new' }).getByRole('tab', { name: crewName }),
  ).toHaveAttribute('aria-selected', 'true');

  // The first tab is spelled by absence, so the screen has one address as it
  // opens rather than two that render the same thing.
  await page.getByRole('tablist', { name: 'What’s new' }).getByRole('tab', { name: 'You' }).click();
  await expect(page).toHaveURL(/\/whats-new$/);
  await expect(page.getByRole('tabpanel', { name: 'You' })).toBeVisible();
});

/**
 * Signed out, `/whats-new` brings a visitor back (integration review, F10).
 *
 * It redirected to a bare `/signin`, so following a link to it meant signing in
 * and then finding the page again by hand. `/crew` has always carried the
 * `next=`; this is the same gate written the same way.
 */
test('a signed-out visitor is sent to sign in and brought back', async ({ page }) => {
  await page.goto('/whats-new');
  await page.waitForURL('**/signin**');
  expect(new URL(page.url()).searchParams.get('next')).toBe('/whats-new');
});

test('a long crew name never widens the page, at any width', async ({ page }) => {
  /*
   * Review B1, and issue #550's general case.
   *
   * `.tabrow .sporttab` is `flex: 1` with `white-space: nowrap`, and a flex
   * item's `min-width` is `auto` — so a label that does not fit refuses to
   * shrink, the row grows past its container and **the whole document** scrolls
   * sideways. Measured before the fix with a 37-character crew name: 475px of
   * document at 320, 360, 375 and 390, the feed panel's right keyline off
   * screen and the last tab cut mid-word.
   *
   * Forty characters, because that is `CREW_NAME_MAX_LENGTH` — the worst case a
   * rider can actually create, not a plausible one. The assertion is the
   * document's own scroll width, which is the thing a rider would see go wrong,
   * rather than any of the numbers the fix happens to be made of.
   */
  const crewName = 'Saturday Morning Skatepark Crew Corby XX'.slice(0, 40);
  expect(crewName).toHaveLength(40);

  await page.setViewportSize({ width: 390, height: 844 });
  await arrive(page, 'Long Name Rider');

  await page.goto('/crew');
  await page.getByLabel('What is it called?').fill(crewName);
  await page.getByRole('button', { name: 'Start it' }).click();
  await expect(page.getByRole('heading', { name: crewName })).toBeVisible();

  await page.goto('/whats-new');
  await expect(page.getByRole('tab', { name: crewName })).toBeVisible();

  const root = page.locator('html');
  for (const width of [320, 360, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const scroll = await root.evaluate((el) => el.scrollWidth);
    const client = await root.evaluate((el) => el.clientWidth);
    expect(scroll, `the page is ${scroll}px wide in a ${width}px window`).toBeLessThanOrEqual(
      client,
    );
  }

  // The full name is still in the DOM, clipped rather than cut — a screen
  // reader reads all of it, and a pointer gets it from `title`.
  const tab = page.getByRole('tab', { name: crewName });
  await expect(tab).toHaveAttribute('title', crewName);

  // And the same in the desktop dropdown, which is 420px of panel rather than a
  // whole screen and was 473px wide inside it.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/home');
  await bell(page).click();
  const panel = page.getByRole('group', { name: 'What’s new' });
  await expect(panel.getByRole('tab', { name: crewName })).toBeVisible();

  const spill = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(spill, `the dropdown's content is ${spill}px wider than the dropdown`).toBeLessThanOrEqual(
    0,
  );
});

test('saying yes to an event this week badges the bell and sorts to the top', async ({ page }) => {
  /*
   * Review B2, the finding most worth a browser.
   *
   * An event line's `at` used to be the event's date minus seven days, always —
   * so a rider who pressed "I'm going" *inside* the week got a line dated five
   * days in the past: older than their bookmark, so the bell never counted it,
   * and under every sticker earned since, so the list buried it. The unit tests
   * cover the rule; what only a browser shows is that the stamp the rule needs
   * (`event_attendance.created`) actually reaches it from the loader.
   *
   * The event is seeded here rather than borrowed: `seed-schedule.ts` dates its
   * events +14, +21 and −20 days, none of them inside the seven-day window, and
   * an event this spec creates cannot be moved out from under it by another.
   */
  const slug = `e2e-whats-new-${unique()}`;
  // A name of this run's own: every run seeds another event, and two called the
  // same thing make every assertion below ambiguous.
  const eventName = `E2E Bell Jam ${slug.slice(-6)}`;
  const client = await e2eSuperuser();
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await client.collection('events').create({
    slug,
    name: eventName,
    kind: 'Comp',
    town: 'Corby',
    venue: 'Adrenaline Alley',
    date: soon,
    sports: [...SPORT_IDS],
    level: 'All levels',
    price: 'Free',
    spots_copy: '30 riders',
    blurb: 'Seeded by whats-new.spec.ts, three days out.',
    is_live: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await arrive(page, 'Going Rider');

  // Clear the bell *after* earning whatever a new account earns, so the only
  // thing that can light it again is the RSVP.
  await clearTheBell(page);

  /*
   * The event's **own page**, not the list and not `?event=<slug>`.
   *
   * The list draws an "I'm going" on every card and the query param opens a
   * detail modal over it carrying a second one, so any locator that is not
   * scoped to a single event picks whichever came first — including one behind
   * the modal's scrim, where the click is intercepted and `toPass` retries
   * until it times out on a control that works. `/events/<slug>` has exactly
   * one, and the slug is this run's.
   */
  await page.goto(`/events/${slug}`);
  const going = page.getByRole('button', { name: /going/i });
  await expect(async () => {
    await going.click();
    await expect(going).toHaveAttribute('aria-pressed', 'true');
  }).toPass({ timeout: 20_000 });

  await page.goto('/home');
  await expect(bell(page)).toHaveAccessibleName(/^What’s new, [1-9]\d* unread\.$/);

  await page.goto('/whats-new');
  const lines = page.getByText(/\.$/);
  const texts = await lines.allInnerTexts();

  const event = texts.findIndex((line) => line.includes(eventName));
  const signUp = texts.findIndex((line) => line.includes('You earned the Day One sticker.'));

  expect(event, `no event line among: ${texts.join(' | ')}`).toBeGreaterThanOrEqual(0);
  expect(texts[event]).toContain('You said you’re going.');

  /*
   * **Above the sticker the rider was given when they signed up**, which is the
   * assertion that isolates the fix.
   *
   * "Top of the list" would not: pressing "I'm going" earns the "Showed Up"
   * sticker, so the RSVP puts *two* lines on the page and the sticker is the
   * newer of them. What the old rule got wrong is that the event line was dated
   * four days **before** this account existed — so it filed itself below every
   * sticker, including Day One from sign-up minutes earlier, and never counted.
   * This ordering is true with the fix and false without it.
   */
  expect(signUp, 'no Day One line to compare against').toBeGreaterThanOrEqual(0);
  expect(event, `event at ${event}, Day One at ${signUp}`).toBeLessThan(signUp);
});

test('a private crew-mate’s join is not named in the You feed', async ({ browser }) => {
  /*
   * Review B3.
   *
   * The crew feed's own rule is that a `private` rider's activity reaches
   * nobody — `hooks/85_crews.pb.js` says so in a comment written to stop
   * exactly this — and the crew tab's empty state promises it in words. A join
   * line drawn from the crew board would have broken that promise one tab away
   * from where it is made.
   *
   * Two contexts rather than two sign-ups in one page: the session is a single
   * httpOnly cookie, so signing the second rider up would sign the first out,
   * and this test needs both of them at once.
   */
  const owner = await browser.newContext();
  const joiner = await browser.newContext();

  try {
    const ownerPage = await owner.newPage();
    const joinerPage = await joiner.newPage();

    await arrive(ownerPage, 'Ollie Owner');
    await arrive(joinerPage, 'Cara Quiet');

    /*
     * A new profile is private by default (AADC standard 7), which is the state
     * under test — asserted rather than assumed, because the whole point is
     * that this rider is private.
     *
     * **`/^Private/`, the profile-privacy radio.** This read `/Only me/` until
     * the second review pass, and there is no such profile-privacy option: the
     * three are "Public", "Riders only" and "Private" (`PRIVACY` in
     * `packages/core/src/data/profile.ts`). "Only me" is the default of the
     * *sessions* visibility group, which renders only where `sessionsEnabledFor`
     * is true — so on a server with `LANDIT_SESSIONS_OPEN=1` the assertion found
     * that radio, it was checked, and the test went green through a door that
     * has nothing to do with profile privacy; without the flag it found nothing
     * and failed. Exactly the shape LESSONS §5 warns about, in a file whose own
     * comments argue against it twice.
     */
    // `/account/privacy` rather than `/account` since T51 (rethink §3.9), which
    // also closes the door the comment above is about: the sessions radios are
    // on a screen of their own now, so there is no second group here for this
    // assertion to find by accident.
    await joinerPage.goto('/account/privacy');
    await expect(joinerPage.getByRole('radio', { name: /^Private/ })).toBeChecked();

    const crewName = `Ramp Rats ${unique()}`;
    await ownerPage.goto('/crew');
    await ownerPage.getByLabel('What is it called?').fill(crewName);
    await ownerPage.getByRole('button', { name: 'Start it' }).click();
    await expect(ownerPage.getByRole('heading', { name: crewName })).toBeVisible();

    await ownerPage.getByRole('button', { name: 'Invite a mate' }).click();
    const code = await ownerPage
      .getByText(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/)
      .first()
      .innerText();
    expect(code).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    await ownerPage.getByRole('button', { name: 'Done' }).click();

    await joinerPage.goto('/crew');
    await joinerPage.getByLabel('The code a mate sent you').fill(code);
    await joinerPage.getByRole('button', { name: 'Join' }).click();
    await expect(joinerPage.getByRole('heading', { name: crewName })).toBeVisible();

    await ownerPage.goto('/whats-new');
    await expect(ownerPage.getByRole('heading', { level: 1, name: 'What’s new' })).toBeVisible();

    // No line names them, and none is drawn without a name either — "A rider
    // joined" would be the product narrating somebody it may not name.
    await expect(ownerPage.getByText(/Cara Quiet/)).toBeHidden();
    await expect(ownerPage.getByText(/joined /)).toBeHidden();

    /*
     * And the crew tab agrees, which is the promise this is keeping.
     *
     * Not "the crew feed is empty" — starting a crew awards the owner the
     * "Crewed Up" sticker, so the feed has the owner's own row in it. The
     * assertion is that **Cara** is nowhere in it, which is the thing the crew
     * feed's rule actually promises and the thing the You tab now matches.
     */
    await ownerPage.getByRole('tab', { name: crewName }).click();
    await expect(ownerPage.getByText(/^Ollie Owner/).first()).toBeVisible();
    await expect(ownerPage.getByText(/Cara Quiet/)).toBeHidden();
  } finally {
    await owner.close();
    await joiner.close();
  }
});

test('every control on the panel is a 44px target', async ({ page }) => {
  /*
   * Review S4. "Mark all read" measured 40px at 320, 375 and 390 — the only
   * control on this screen under §4's floor, and invisible to
   * `shell.spec.ts`'s 44px assertion, which walks `.btn` and `.sporttab` and
   * knows nothing about a text button.
   */
  await page.setViewportSize({ width: 320, height: 844 });
  await arrive(page, 'Thumb Rider');
  await page.goto('/whats-new');

  const markRead = page.getByRole('button', { name: /Mark all read|All read/ });
  await expect(markRead).toBeVisible();

  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const box = await markRead.boundingBox();
    expect(
      box?.height,
      `"Mark all read" is ${box?.height}px tall at ${width}`,
    ).toBeGreaterThanOrEqual(44);
  }
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
