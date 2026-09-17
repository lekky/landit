import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';

/**
 * The account as a settings list (app shell rethink §3.9, T51).
 *
 * What is worth pinning here is the *navigation*, because that is the whole of
 * what changed: the controls are the same controls, and `profile.spec.ts`,
 * `session-plans.spec.ts` and `auth.spec.ts` still prove each of them saves.
 *
 * So: the list says what every setting is currently on; a row opens its own
 * screen on a phone and the back link comes home; the same address on a desktop
 * puts the list beside the panel rather than instead of it; and the two
 * conditional rows are only ever offered to the riders they are about.
 *
 * Which rows exist for which rider is asserted in `src/lib/accountRows.test.ts`
 * instead — the e2e server runs with `LANDIT_SESSIONS_OPEN=1`, so every rider
 * here is inside the sessions preview and the "outside it" half is unreachable
 * from a browser.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

/** A date of birth `years` before today, as the date input wants it. */
function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * An onboarded rider, signed in, on the dashboard.
 *
 * `age` decides whether the consent gate applies, which is the only thing that
 * changes the shape of the list — a rider under the threshold lands on
 * `consent_state: 'pending'` and gets the eighth row.
 */
async function onboardedRider(page: Page, age = 24): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Nia Okafor');
  await page.getByLabel('Email', { exact: true }).fill(`e2e-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(age));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await finishOnboarding(page);
  await page.waitForURL('**/home');
}

/** The list itself, by the name it is announced with. */
const listOf = (page: Page) => page.getByRole('navigation', { name: 'Your account' });

test('the list says what every setting is currently on', async ({ page }) => {
  await onboardedRider(page);
  await page.goto('/account');

  const list = listOf(page);

  // The sub-line is the current value, and every one of them is a row in
  // `@landit/core` rather than anything a rider typed.
  await expect(list.getByRole('link', { name: /^Your profile/ })).toBeVisible();
  await expect(list.getByRole('link', { name: /^What you ride/ })).toContainText('Scooter');
  await expect(list.getByRole('link', { name: /^Who can see your profile/ })).toContainText(
    'Private',
  );
  await expect(list.getByRole('link', { name: /^Plans and billing/ })).toContainText('Rookie');
  await expect(list.getByRole('link', { name: /^Coach . parent view/ })).toBeVisible();
  await expect(list.getByRole('link', { name: /^Your data/ })).toBeVisible();

  // The e2e server has `LANDIT_SESSIONS_OPEN=1`, so the preview covers everybody.
  await expect(list.getByRole('link', { name: /^Who sees new sessions/ })).toContainText('Only me');

  // An adult was never held behind the gate, so there is nothing to ask.
  await expect(list.getByRole('link', { name: /^Your guardian/ })).toHaveCount(0);

  // Nothing on the old screen's stack of panels is on this one.
  await expect(page.getByRole('radio', { name: /^Private/ })).toHaveCount(0);
});

test('a row opens its own screen on a phone, and the back link comes home', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await onboardedRider(page);
  await page.goto('/account');

  await listOf(page)
    .getByRole('link', { name: /^Who can see your profile/ })
    .click();
  await page.waitForURL('**/account/privacy');

  // The screen is the panel, with the setting's own words at the top of it and
  // the control under them — and the list is somewhere else, not under it.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Who can see your profile');
  await expect(page.getByRole('radio', { name: /^Private/ })).toBeChecked();
  await expect(listOf(page)).toBeHidden();

  await page.getByRole('link', { name: 'Your account', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/account');
  await expect(listOf(page)).toBeVisible();
});

test('every row lands on the screen it names, on a phone', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await onboardedRider(page);

  for (const [name, path, heading] of [
    ['Your profile', '/account/profile', 'Your profile'],
    ['What you ride', '/account/sports', 'What you ride'],
    ['Who can see your profile', '/account/privacy', 'Who can see your profile'],
    ['Who sees new sessions', '/account/sessions', 'Who sees new sessions'],
    ['Your data', '/account/data', 'Your data'],
  ] as const) {
    await page.goto('/account');
    await listOf(page)
      .getByRole('link', { name: new RegExp(`^${name}`) })
      .click();
    await page.waitForURL(`**${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
  }

  // The two rows that leave the account for a screen of the product's own.
  await page.goto('/account');
  await listOf(page)
    .getByRole('link', { name: /^Plans and billing/ })
    .click();
  await page.waitForURL('**/plans');

  await page.goto('/account');
  await listOf(page)
    .getByRole('link', { name: /^Coach . parent view/ })
    .click();
  await page.waitForURL('**/coach');
});

test('the desktop keeps the list beside the panel, and a link lands on the right one', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await onboardedRider(page);

  // Straight to the address, the way a bookmark or a shared link arrives.
  await page.goto('/account/privacy');

  await expect(listOf(page)).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Private/ })).toBeChecked();

  // The row whose screen is open says so, and the phone's back link is not
  // drawn over the top of a list that is already on screen.
  await expect(
    listOf(page).getByRole('link', { name: /^Who can see your profile/ }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Your account', exact: true })).toBeHidden();
});

/*
 * Pressing a row on a desktop swaps the panel; it does not fetch the page again.
 *
 * The test above deep-links, which is the other half. This one is the half a
 * rider actually does, and the thing worth pinning is that the URL moves and the
 * lit row moves **without a document load** — a master/detail that reloads the
 * whole screen to change the right-hand pane is a list of links wearing a
 * layout. `page.on('load')` is how that is asked without a DOM lib: it fires on
 * a real navigation and not on a client-side one.
 */
test('a desktop row press swaps the panel without reloading the page', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await onboardedRider(page);

  let loads = 0;
  page.on('load', () => {
    loads += 1;
  });

  await page.goto('/account');
  await expect(listOf(page)).toBeVisible();
  const documentLoads = loads;

  await listOf(page)
    .getByRole('link', { name: /^Who can see your profile/ })
    .click();
  await page.waitForURL('**/account/privacy');

  await expect(page.getByRole('radio', { name: /^Private/ })).toBeChecked();
  await expect(
    listOf(page).getByRole('link', { name: /^Who can see your profile/ }),
  ).toHaveAttribute('aria-current', 'page');
  // And the row it moved off no longer claims it.
  await expect(listOf(page).getByRole('link', { name: /^Your profile/ })).not.toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(loads).toBe(documentLoads);

  // Back is the list again, still without a reload.
  await page.goBack();
  await page.waitForURL((url) => url.pathname === '/account');
  expect(loads).toBe(documentLoads);
});

/*
 * `/account/close` is outside the settings list on purpose, and the one link it
 * has into it is the download — which moved with the panel (T51). A rider told
 * to take a copy of their data before closing their account should land on the
 * download, not on a list of eight rows with the download behind one of them.
 */
test('closing an account points at the data screen, not at the list', async ({ page }) => {
  await onboardedRider(page);
  await page.goto('/account/close');

  await page.getByRole('link', { name: 'Download your data' }).click();
  await page.waitForURL('**/account/data');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your data');
  // And the thing they came for is on it: the export route itself, which is
  // untouched by any of this.
  await expect(page.getByRole('link', { name: 'Download your data' })).toHaveAttribute(
    'href',
    '/api/account/export',
  );
});

test('the guardian row is the gate’s way in, and nobody else is offered it', async ({ page }) => {
  await onboardedRider(page, 11);
  await page.goto('/account');

  // The panel itself is under the lede, where it was before the list: a child
  // waiting on a grown-up meets the thing that asks one, not a chevron.
  await expect(page.getByText(/a grown-up needs to say yes/i)).toBeVisible();
  await expect(page.getByLabel(/parent or carer/i)).toBeVisible();

  await expect(listOf(page).getByRole('link', { name: /^Your guardian/ })).toContainText(
    'Waiting on a grown-up',
  );

  await listOf(page)
    .getByRole('link', { name: /^Your guardian/ })
    .click();
  await page.waitForURL('**/account/guardian');
  await expect(page.getByText(/a grown-up needs to say yes/i)).toBeVisible();
  await expect(page.getByLabel(/parent or carer/i)).toBeVisible();
});

/*
 * Issue #558. Three links still said "your account" and meant one of the seven
 * screens `/account` became a list of. This is the one that matters most: it is
 * on the screen a child held behind the consent gate is most likely to be
 * standing on, it was the only control that panel has, and it measured 19px.
 */
test('the crew gate points a waiting child straight at the guardian screen', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await onboardedRider(page, 11);

  await page.goto('/crew');
  const ask = page.getByRole('link', { name: /Ask them again from your account/ });
  await expect(ask).toBeVisible();

  // §4's floor. It was a line of text with no padding at all — the way in for
  // the rider with the least reason to be able to find anything else.
  const box = await ask.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  await ask.click();
  await page.waitForURL('**/account/guardian');
  await expect(page.getByLabel(/parent or carer/i)).toBeVisible();
});

test('a rider the gate does not apply to is sent back to the list', async ({ page }) => {
  await onboardedRider(page);

  // Not a 404 and not an error: the screen exists, it is simply not about them.
  await page.goto('/account/guardian');
  await page.waitForURL((url) => url.pathname === '/account');
});

/*
 * The same answer for the sessions preview — and the one assertion in this file
 * that the suite's own server usually cannot make.
 *
 * `playwright.config.ts` runs the app with `LANDIT_SESSIONS_OPEN=1`, so every
 * rider here is inside the preview and there is nobody to be redirected. The
 * test asks the screen which world it is in rather than guessing, and skips
 * loudly where the flag is on: a skip that names its reason is a gap somebody
 * can see, where a test quietly asserting the other branch would be a gap
 * nobody can.
 */
test('a rider outside the sessions preview is sent back to the list', async ({ page }) => {
  await onboardedRider(page);
  await page.goto('/account');

  const row = listOf(page).getByRole('link', { name: /^Who sees new sessions/ });
  test.skip(
    (await row.count()) > 0,
    'this server has LANDIT_SESSIONS_OPEN=1, so the preview covers every rider',
  );

  await page.goto('/account/sessions');
  await page.waitForURL((url) => url.pathname === '/account');
});

test('the account screens are signed-in only', async ({ page }) => {
  for (const path of [
    '/account/profile',
    '/account/sports',
    '/account/privacy',
    '/account/sessions',
    '/account/guardian',
    '/account/data',
  ]) {
    await page.goto(path);
    await page.waitForURL((url) => url.pathname === '/signin');
  }
});
