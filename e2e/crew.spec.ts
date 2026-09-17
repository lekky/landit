import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';
import { e2eSuperuser } from './support/seed-library';

/**
 * The crew screen and a rider's profile, after the rethink (T52, §3.10).
 *
 * Both screens changed shape rather than changing what they hold: the crew's
 * board and feed became two tabs of three, and the profile's landed list,
 * stickers and videos became three of its own. So what is worth asserting here
 * is the join between the new controls and the old rules —
 *
 *  - **the row is really three tabs**, and each one puts its own panel up;
 *  - **Members is the board's own rows and nothing more**, which is what keeps
 *    plan §3 guarantee 1 where it was: a crew-mate is named by the crew-board
 *    route, not by `users`;
 *  - **a private rider is on the board and in Members and never in Activity**,
 *    which is the promise `hooks/85_crews.pb.js` makes in a comment and the
 *    Activity tab's empty state makes in words;
 *  - **the two ways into another crew open one form each**, where a single
 *    `<details>` used to open both.
 *
 * Nothing here is a screenshot test. The shapes are checked by role — `tab`,
 * `tabpanel`, `button` — because that is also what a screen reader is given,
 * and a row that looks right while announcing itself as something else is the
 * failure mode a boxed tab row invites.
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
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Date of birth').fill(birthDate(21));
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  await finishOnboarding(page);
  await page.waitForURL('**/home');
  return email;
}

/** Start a crew from the empty state and wait for its screen. */
async function startCrew(page: Page, name: string): Promise<void> {
  await page.goto('/crew');
  await page.getByLabel('What is it called?').fill(name);
  await page.getByRole('button', { name: 'Start it' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('the crew screen is Board · Activity · Members, and each tab shows its own panel', async ({
  page,
}) => {
  await arrive(page, 'Tabby Rider');
  const crewName = `Ramp Rats ${unique()}`;
  await startCrew(page, crewName);

  const tabs = page.getByRole('tablist', { name: 'What to show for this crew' });
  await expect(tabs.getByRole('tab')).toHaveCount(3);
  // Board is where the screen opens, and its tab is the pressed one.
  await expect(tabs.getByRole('tab', { name: 'Board' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('This month’s board')).toBeVisible();

  // The tab is in `?tab=`, so a reload and a Back both come back here (§3.10).
  await tabs.getByRole('tab', { name: 'Activity' }).click();
  await expect(page).toHaveURL(/tab=activity/);
  await expect(page.getByText('Just happened')).toBeVisible();
  await expect(page.getByText('This month’s board')).toBeHidden();

  /*
   * "Members", and only that (review nit 10). The tab carried the crew's rider
   * count until the second pass, ten pixels under a header that already reads
   * "RAMP RATS · 1 RIDER" — `note` is there to give a reason to press a tab,
   * and here the reason was already answered. `exact` rather than a regex, so
   * the count coming back fails this.
   */
  await expect(tabs.getByRole('tab', { name: 'Members', exact: true })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 }).locator('..')).toContainText('1 rider');

  await tabs.getByRole('tab', { name: 'Members', exact: true }).click();
  await expect(page).toHaveURL(/tab=members/);
  await expect(page.getByText('Who is in it')).toBeVisible();
  // A crew of one is the rider who started it, marked as such.
  await expect(page.getByText('Tabby Rider (you)')).toBeVisible();
  await expect(page.getByText('Started it')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Who is in it')).toBeVisible();
});

test('a deep link opens the tab it names, without a press', async ({ page }) => {
  /*
   * Review §6: the tab test above clicks and then reloads, which proves the
   * address is *written*. This proves it is *read* — a rider arriving from a
   * link, a bookmark or the back button lands on the tab the URL names rather
   * than on Board with a `?tab=` that says otherwise.
   *
   * And a hand-typed value nobody has opens the first tab rather than an empty
   * screen, which is the promise `useTabParam` makes about validating the value
   * against the tabs the caller actually has.
   */
  await arrive(page, 'Deep Link');
  const crewName = `Ramp Rats ${unique()}`;
  await startCrew(page, crewName);

  await page.goto('/crew?tab=members');
  const tabs = page.getByRole('tablist', { name: 'What to show for this crew' });
  await expect(tabs.getByRole('tab', { name: 'Members', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText('Who is in it')).toBeVisible();

  await page.goto('/crew?tab=nonsense');
  await expect(tabs.getByRole('tab', { name: 'Board' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('This month’s board')).toBeVisible();
});

test('"Start another" and "Join with a code" open one form each', async ({ page }) => {
  await arrive(page, 'Second Crew');
  await startCrew(page, `Ramp Rats ${unique()}`);

  const another = page.getByRole('button', { name: 'Start another' });
  const join = page.getByRole('button', { name: 'Join with a code' });

  // Closed to begin with: neither form is on the screen until it is asked for.
  await expect(another).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('What is it called?')).toBeHidden();
  await expect(page.getByLabel('The code a mate sent you')).toBeHidden();

  await another.click();
  await expect(page.getByLabel('What is it called?')).toBeVisible();
  // One at a time. They are alternatives, not a pair.
  await expect(page.getByLabel('The code a mate sent you')).toBeHidden();

  await join.click();
  await expect(page.getByLabel('The code a mate sent you')).toBeVisible();
  await expect(page.getByLabel('What is it called?')).toBeHidden();
  await expect(another).toHaveAttribute('aria-expanded', 'false');

  /*
   * §4's floor has no width on it (review finding 4). These measured 36px at
   * 1280 and 44px on a phone, because `.btn.sm` only reaches 44 inside
   * `additions.css`'s coarse-pointer block — so the floor arrived with the
   * pointer rather than with the rule.
   */
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const button of [another, join]) {
      const box = await button.boundingBox();
      const label = await button.innerText();
      /*
       * Rounded: a `min-height: 44px` box measures 43.99993896484375 at 320,
       * which is the browser's sub-pixel layout and not a control under the
       * floor. The defect this guards is 36 against 44, eight whole pixels.
       */
      expect(
        Math.round(box?.height ?? 0),
        `"${label}" is ${box?.height}px tall at ${width}`,
      ).toBeGreaterThanOrEqual(44);
    }
  }
});

test('a private crew-mate is on the board and in Members, and never in Activity', async ({
  browser,
}) => {
  /*
   * The rule this is about is `hooks/85_crews.pb.js`'s: the **board** may name
   * a rider whose profile is private, by name and score, to a crew-mate (plan
   * §3 guarantee 1) — and the **feed** deliberately does not inherit that
   * carve-out, because what a rider *did* is more than a name and a score.
   *
   * Members is drawn from the board's own rows, so it is on the naming side of
   * that line and has to stay there: a third tab that quietly read `users`
   * instead would show fewer people, and one that showed activity would show
   * more than the feed beside it. Both failures are silent on a screen with one
   * member in it, which is why this makes two.
   *
   * Two browser contexts rather than two sign-ups in one page: the session is a
   * single httpOnly cookie, so signing the second rider up would sign the first
   * out, and this needs both at once.
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
     * under test — asserted rather than assumed.
     *
     * `/account/privacy`, not `/account`: T51 made the account a list of rows
     * where each row is its own screen (§3.9), so the three privacy radios are
     * no longer on the landing screen. Reading them from the list would be
     * asserting against a screen that does not have them.
     */
    await joinerPage.goto('/account/privacy');
    await expect(joinerPage.getByRole('radio', { name: /^Private/ })).toBeChecked();

    const crewName = `Ramp Rats ${unique()}`;
    await startCrew(ownerPage, crewName);

    await ownerPage.getByRole('button', { name: 'Invite a mate' }).click();
    const code = await ownerPage
      .getByText(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/)
      .first()
      .innerText();
    await ownerPage.getByRole('button', { name: 'Done' }).click();

    await joinerPage.goto('/crew');
    await joinerPage.getByLabel('The code a mate sent you').fill(code);
    await joinerPage.getByRole('button', { name: 'Join' }).click();
    await expect(joinerPage.getByRole('heading', { name: crewName })).toBeVisible();

    await ownerPage.goto('/crew');
    const tabs = ownerPage.getByRole('tablist', { name: 'What to show for this crew' });

    // The board names them. That is the carve-out, and it is unchanged.
    await expect(ownerPage.getByText('Cara Quiet')).toBeVisible();

    // So does Members, because Members is the board's rows without the ranking.
    await tabs.getByRole('tab', { name: 'Members', exact: true }).click();
    await expect(ownerPage.getByText('Who is in it')).toBeVisible();
    await expect(ownerPage.getByText('Cara Quiet')).toBeVisible();

    /*
     * Activity does not. Not "the feed is empty" — starting a crew awards the
     * owner the "Crewed Up" sticker, so the owner's own row is in it; the
     * assertion is that Cara is not, which is exactly what the feed's rule
     * promises and what the empty state says in words.
     */
    await tabs.getByRole('tab', { name: 'Activity' }).click();
    await expect(ownerPage.getByText('Just happened')).toBeVisible();
    await expect(ownerPage.getByText('Cara Quiet')).toBeHidden();
  } finally {
    await owner.close();
    await joiner.close();
  }
});

test('a rider profile is the card and Landed · Stickers, with no empty Videos tab', async ({
  page,
}) => {
  await arrive(page, 'Profile Rider');
  await page.goto('/crew');
  await page.getByRole('link', { name: 'Your public profile' }).click();

  // The card keeps its three numbers above the row (§3.10).
  await expect(page.getByText('Landed', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Stickers', { exact: true }).first()).toBeVisible();

  const tabs = page.getByRole('tablist', { name: 'What to show on this profile' });
  /*
   * Two tabs, not three. A rider with no videos — or a viewer who may not see
   * them, which is the same empty list — is not offered a tab that could only
   * ever say "nothing here", because on this screen that sentence is a fact
   * about somebody else's choice. `VideoWall` has always hidden itself for the
   * same reason; this is that rule, one level up.
   */
  await expect(tabs.getByRole('tab')).toHaveCount(2);
  await expect(tabs.getByRole('tab', { name: 'Videos' })).toHaveCount(0);

  await expect(tabs.getByRole('tab', { name: 'Landed' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Nothing landed yet.')).toBeVisible();

  await tabs.getByRole('tab', { name: 'Stickers' }).click();
  await expect(page).toHaveURL(/tab=stickers/);
  await expect(page.getByText('Nothing landed yet.')).toBeHidden();

  /*
   * The back link is the group's (§2.3). Scoped to `#main`, because "Crew" is
   * also a nav item and a footer link on every page in the product — the shell
   * is where a rider's *next* screen is, and this is the one that says where
   * this screen sits under.
   */
  await expect(
    page.locator('#main').getByRole('link', { name: 'Crew', exact: true }),
  ).toBeVisible();

  /*
   * "Change it" goes to the privacy screen (issue #558).
   *
   * It said "your account" and meant one of the seven screens `/account` became
   * a list of, so a rider reading "Who sees this" about their own profile was
   * sent to a list of eight rows to find the one they had just been told about.
   */
  await page.getByRole('link', { name: 'Change it' }).click();
  await page.waitForURL('**/account/privacy');
});

test('the Videos tab appears once there is a clip, and plays nothing until pressed', async ({
  page,
}) => {
  /*
   * The other half of the rule (review §6): the spec above proves the tab is
   * **absent** when the wall is empty, which is the privacy half, and nothing
   * proved it comes back. A rule that only ever hides something would pass with
   * the tab deleted.
   *
   * A paid rider, because a clip link is a paid allowance — `users.plan` is
   * server-owned, so the fixture moves it the way only the server can, exactly
   * as `video-links.spec.ts` does.
   */
  const email = await arrive(page, 'Clip Rider');
  const admin = await e2eSuperuser();
  const rider = await admin
    .collection('users')
    .getFirstListItem(`email="${email}"`, { fields: 'id' });
  await admin.collection('users').update(rider.id, { plan: 'shredder' });

  await page.goto('/library');
  await page.locator('a[href^="/library/"]').first().click();
  await page.getByRole('tab', { name: /Your videos/ }).click();
  await page.getByLabel('YouTube link').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Play / })).toBeVisible();

  await page.goto('/crew');
  const href = await page.getByRole('link', { name: 'Your public profile' }).getAttribute('href');
  await page.goto(String(href));

  const tabs = page.getByRole('tablist', { name: 'What to show on this profile' });
  await expect(tabs.getByRole('tab')).toHaveCount(3);
  await tabs.getByRole('tab', { name: 'Videos' }).click();
  await expect(page).toHaveURL(/tab=videos/);
  await expect(page.getByRole('button', { name: /^Play / })).toBeVisible();
  /*
   * Click-to-play: nothing reaches Google before the press (T35's rule, which
   * putting the wall behind a tab of its own must not quietly undo).
   */
  await expect(page.locator('iframe')).toHaveCount(0);
});
