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

test('the guardian row is the gate’s way in, and nobody else is offered it', async ({ page }) => {
  await onboardedRider(page, 11);
  await page.goto('/account');

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

test('a rider the gate does not apply to is sent back to the list', async ({ page }) => {
  await onboardedRider(page);

  // Not a 404 and not an error: the screen exists, it is simply not about them.
  await page.goto('/account/guardian');
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
