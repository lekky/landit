import { CONTACT, HEARD_ABOUT, SPORTS, SPORT_IDS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';

/**
 * Sign-up, onboarding and the guardian-consent flow (T6), against a real
 * PocketBase — see `playwright.config.ts` for why it is on its own port and its
 * own database.
 *
 * The assertion this file exists for is the third one: **the date of birth never
 * leaves the browser**. Everything else here could be re-derived from the unit
 * and API tests; that one can only be observed where the form actually is.
 *
 * What is *not* tested here: the emails. That used to be because there was no
 * mail account and no verified sending domain, which stopped being true on
 * 2026-08-18 (`docs/infrastructure.md`). It needed neither in the end —
 * `e2e/password-reset.spec.ts` catches what PocketBase sends on a socket of its
 * own and reads the real message off it. This file stays about the sign-up form.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

/** A date of birth `years` before today, as the date input wants it. */
function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

async function fillSignUp(
  page: Page,
  options: { name: string; email: string; country: string; dob: string },
) {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill(options.name);
  await page.getByLabel('Email').fill(options.email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption(options.country);
  await page.getByLabel('Date of birth').fill(options.dob);
}

test('the sign-up form asks for a date of birth it cannot send', async ({ page }) => {
  await page.goto('/signup');

  // An input with no `name` is not part of the submission. This is the whole
  // mechanism behind "the date of birth never leaves the device" (plan §3), and
  // it is one careless attribute away from being untrue.
  await expect(page.getByLabel('Date of birth')).not.toHaveAttribute('name', /.*/);
  await expect(page.getByText(/never sent to us and never stored/i)).toBeVisible();
});

test('the sign-up form does not zoom the page out from under a rider', async ({ page }) => {
  await page.goto('/signup');

  /*
   * The regression this pins (`packages/ui-web/src/styles/primitives.css`, and
   * the tenth divergence in the plan). Two browser gestures were zooming riders
   * in without their asking, and both are fixed in CSS that looks like a design
   * value somebody could tidy back.
   *
   * The first: iOS zooms the whole page in when a field under 16px takes focus,
   * and does not zoom back out when it loses it. The design pack draws these
   * fields at 15px, so this assertion is what stops a later session restoring
   * the design's value and the defect with it.
   *
   * Chromium cannot show us the zoom itself, so the documented 16px threshold is
   * what we can hold. `toHaveCSS` rather than `getComputedStyle`, because this
   * project's e2e tsconfig has no DOM lib (the same note as `profile.spec.ts`).
   */
  const fields = page.locator('.field input, .field select, .field textarea');
  const count = await fields.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await expect(fields.nth(index)).toHaveCSS('font-size', '16px');
  }

  /*
   * The second: a double tap is still the browser's "zoom in", and on a phone it
   * is mostly a rider tapping twice because the first tap did not look like it
   * landed. `manipulation` drops that gesture and leaves pinch alone, which is
   * the point — pinch is how a rider undoes a zoom they did not mean.
   */
  await expect(page.getByRole('button', { name: 'Create account' })).toHaveCSS(
    'touch-action',
    'manipulation',
  );
});

test('the date of birth is not in what the browser posts', async ({ page }) => {
  const dob = birthDate(30);
  const email = `e2e-${unique()}@landit.invalid`;

  const bodies: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    const body = request.postData();
    if (body) bodies.push(body);
  });

  await fillSignUp(page, { name: 'Dob Watcher', email, country: 'GB', dob });
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');

  expect(bodies.length).toBeGreaterThan(0);
  for (const body of bodies) {
    expect(body).not.toContain(dob);
    // Both spellings a date input could plausibly be serialised as.
    expect(body).not.toContain(dob.replaceAll('-', '/'));
  }
  // What it *does* send is the band and the day that band changes.
  expect(bodies.some((body) => body.includes('adult'))).toBe(true);
});

test('a rider under their country’s threshold is told before they sign up', async ({ page }) => {
  await fillSignUp(page, {
    name: 'Younger Rider',
    email: `e2e-${unique()}@landit.invalid`,
    country: 'GB',
    dob: birthDate(11),
  });

  await expect(page.getByText('A grown-up will need to say yes')).toBeVisible();
  // Not a refusal: they can still make the account.
  await expect(page.getByRole('button', { name: 'Create account' })).toBeEnabled();
});

test('a US under-13 is declined, with the reason and no account', async ({ page }) => {
  await fillSignUp(page, {
    name: 'US Rider',
    email: `e2e-${unique()}@landit.invalid`,
    country: 'US',
    dob: birthDate(11),
  });

  await expect(page.getByText('We cannot sign you up yet')).toBeVisible();
  await expect(page.getByText(/a rider under 13 needs a kind of parental consent/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();
});

test('sign up, onboard and land on the dashboard', async ({ page }) => {
  const email = `e2e-${unique()}@landit.invalid`;
  await fillSignUp(page, { name: 'Miles Carter', email, country: 'GB', dob: birthDate(22) });
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alright Miles');

  // One card per sport, which is three since T21 — screenshot 05 shows two
  // because it predates the decision (plan §7).
  for (const id of SPORT_IDS) {
    await expect(
      page.getByRole('button', { name: new RegExp(SPORTS[id].label, 'i') }),
    ).toBeVisible();
  }
  expect(SPORT_IDS.length).toBe(3);

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Just started/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Land my first trick' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 5, answered rather than skipped — the one walkthrough that does. It is
  // a closed list, so what is asserted is that the nine options are all there is
  // and that none of them opens a box: a "tell us where" field on this screen
  // would be a place a child types about themselves, which is the thing the
  // whole design of this question avoids.
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('How did you find us?');
  for (const option of HEARD_ABOUT) {
    await expect(page.getByRole('button', { name: option.label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'YouTube', exact: true }).click();
  await page.getByRole('button', { name: "Let's go" }).click();

  // T8 landed a dashboard, so that is where a finished onboarding goes.
  await page.waitForURL('**/home');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alright, Miles.');

  await page.goto('/account');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Miles Carter');
  // The gate does not apply to this rider, so the guardian panel is absent.
  await expect(page.getByText('a grown-up needs to say yes')).toBeHidden();

  // Onboarding is done, so going back to it does not start again.
  await page.goto('/onboarding');
  await page.waitForURL('**/home');
});

test('a younger rider arrives at an account that says what it is waiting for', async ({ page }) => {
  const email = `e2e-${unique()}@landit.invalid`;
  await fillSignUp(page, { name: 'Nia Okafor', email, country: 'GB', dob: birthDate(11) });
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await finishOnboarding(page);

  await page.waitForURL('**/home');
  await page.goto('/account');
  await expect(page.getByText(/a grown-up needs to say yes/i)).toBeVisible();
  // What they can do comes first, and it is most of the product.
  await expect(page.getByText('Log every trick you land')).toBeVisible();
  await expect(page.getByText('Join or start a crew')).toBeVisible();

  await page.getByLabel(/parent or carer/i).fill('guardian@landit.invalid');
  await page.getByRole('button', { name: 'Ask them' }).click();
  await expect(page.getByText(/We have written to guardian@landit.invalid/)).toBeVisible();
  // Local PocketBase has no mail account, so the send fails and the screen says so
  // rather than pretending a parent has been written to. It no longer blames
  // "launch" for it: the product launched on 2026-08-17 and a rider reading that
  // would be told to wait for something that already happened.
  await expect(page.getByText(/that is our end, not yours/i)).toBeVisible();
});

test('a guardian link that is not valid says so, and offers a way out', async ({ page }) => {
  await page.goto('/consent/approve/not-a-real-token');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('That link is not valid');
  await expect(page.getByText(CONTACT.safeguarding)).toBeVisible();
  // Nothing to press: an invalid link cannot approve anything.
  await expect(page.getByRole('button', { name: /approve/i })).toHaveCount(0);
});

test('the account screen is signed-in only', async ({ page }) => {
  await page.goto('/account');
  await page.waitForURL('**/signin');
});

test('signing out ends the session', async ({ page }) => {
  const email = `e2e-${unique()}@landit.invalid`;
  await fillSignUp(page, { name: 'Bye Rider', email, country: 'GB', dob: birthDate(25) });
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');

  await finishOnboarding(page);
  await page.waitForURL('**/home');

  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await page.goto('/account');
  await page.waitForURL('**/signin');
});

test('signing back in returns the rider to their account', async ({ page }) => {
  const email = `e2e-${unique()}@landit.invalid`;
  await fillSignUp(page, { name: 'Return Rider', email, country: 'GB', dob: birthDate(28) });
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');

  await page.context().clearCookies();

  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Onboarding was never finished, so that is where they go.
  await page.waitForURL('**/onboarding');
});

test('a wrong password says nothing about whether the account exists', async ({ page }) => {
  const email = `nobody-${unique()}@landit.invalid`;
  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('That email and password do not match an account')).toBeVisible();
  // The address survives the refusal and the password does not (issue #370):
  // React 19 resets a form when its action settles, and this used to empty both.
  await expect(page.getByLabel('Email')).toHaveValue(email);
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.getByText(/failed to authenticate/i)).toHaveCount(0);
});

test('a taken email keeps what was typed, and offers sign-in instead', async ({ page }) => {
  const email = `e2e-${unique()}@landit.invalid`;
  await fillSignUp(page, { name: 'First Rider', email, country: 'GB', dob: birthDate(25) });
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  await page.context().clearCookies();

  // The second attempt is a gated rider with a grown-up's address, so the
  // consent half of the form is on screen when the refusal lands — the path
  // the form must not disturb.
  const dob = birthDate(11);
  const guardian = `guardian-${unique()}@landit.invalid`;
  await fillSignUp(page, { name: 'Second Try', email, country: 'GB', dob });
  await page.getByLabel('A grown-up’s email').fill(guardian);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Wait on something only the server could have produced.
  const taken = page.getByText('That email already has an account.');
  await expect(taken).toBeVisible();

  // The point of the test (issue #370): nothing the rider typed is gone except
  // the password, which is cleared on purpose and never sent back.
  await expect(page.getByLabel('Your name')).toHaveValue('Second Try');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.getByLabel('Where you live')).toHaveValue('GB');
  await expect(page.getByLabel('Date of birth')).toHaveValue(dob);
  await expect(page.getByLabel('A grown-up’s email')).toHaveValue(guardian);
  await expect(page.getByText('A grown-up will need to say yes')).toBeVisible();

  // A way out, and none of PocketBase's words.
  await expect(page.getByRole('link', { name: 'Sign in instead?' })).toHaveAttribute(
    'href',
    '/signin',
  );
  await expect(page.getByText(/must be unique|failed to create/i)).toHaveCount(0);

  // Fixing the field takes its error away; the next press can bring it back.
  await page.getByLabel('Email', { exact: true }).fill(`e2e-${unique()}@landit.invalid`);
  await expect(taken).toBeHidden();
});

test('a dead reset link says it has expired, and where to get a fresh one', async ({ page }) => {
  await page.goto('/reset-password?token=not-a-real-token');
  await page.getByLabel('New password').fill('a-long-new-password');
  await page.getByRole('button', { name: 'Set the password' }).click();

  await expect(page.getByText('That link has expired.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ask for a fresh one' })).toHaveAttribute(
    'href',
    '/forgot-password',
  );
  // PocketBase's words for this were "An error occurred while validating the
  // submitted data." — true, and useless to a rider holding a dead link.
  await expect(page.getByText(/error occurred|validating|invalid or expired/i)).toHaveCount(0);
});

test('a dead confirmation link says it has expired, and where to get a fresh one', async ({
  page,
}) => {
  await page.goto('/verify-email?token=not-a-real-token');
  await page.getByRole('button', { name: 'Confirm this email' }).click();

  await expect(page.getByText('That link has expired.')).toBeVisible();
  // The dashboard, not /forgot-password: the reminder there sends a fresh
  // confirmation, and a reset email is not what this rider asked for.
  await expect(
    page.getByRole('link', { name: 'Get a fresh one from your dashboard' }),
  ).toHaveAttribute('href', '/home');
  await expect(page.getByText(/error occurred|validating|claim/i)).toHaveCount(0);
});

test('an unverified rider is reminded, once, and can put it away', async ({ page }) => {
  const email = `e2e-${unique()}@landit.invalid`;
  await fillSignUp(page, { name: 'Ada Nkemdi', email, country: 'GB', dob: birthDate(24) });
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');

  // Onboarding is outside the (app) group deliberately, so the reminder is not
  // one of the things competing for a rider's first four screens.
  await expect(page.getByRole('status').filter({ hasText: 'Confirm your email' })).toBeHidden();

  await finishOnboarding(page);
  await page.waitForURL('**/home');

  // Local PocketBase has no mail account, so nothing is delivered — but the
  // rider is unverified either way, which is the state the banner reads.
  const banner = page.getByRole('status').filter({ hasText: 'Confirm your email' });
  await expect(banner).toBeVisible();

  // It explains rather than threatens, and nothing about the account is gated:
  // onboarding is reachable and the rider is on it.
  await expect(banner).toContainText('the reset goes to this address');

  await banner.getByRole('button', { name: 'Not now' }).click();
  await expect(banner).toBeHidden();

  // Dismissal is a cookie the server reads, so it survives a navigation rather
  // than coming back on the next render.
  await page.goto('/account');
  await expect(page.getByRole('status').filter({ hasText: 'Confirm your email' })).toBeHidden();
});

test('the verification screen does not confirm anything by being visited', async ({ page }) => {
  await page.goto('/verify-email?token=not-a-real-token');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Confirm your email');

  // The token is in a form, not acted on by the GET — a mail scanner following
  // the link confirms nothing (plan §6.2).
  await expect(page.getByRole('button', { name: 'Confirm this email' })).toBeVisible();

  await page.goto('/verify-email');
  await expect(page.getByText('That link is not complete')).toBeVisible();
});

test('a gated rider is asked for a grown-up at sign-up, and may skip it', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Kai Mensah');
  await page.getByLabel('Email', { exact: true }).fill(`e2e-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');

  // Nothing is asked until the date of birth says the gate applies.
  await expect(page.getByLabel('A grown-up’s email')).toBeHidden();

  await page.getByLabel('Date of birth').fill(birthDate(11));
  await expect(page.getByLabel('A grown-up’s email')).toBeVisible();
  await expect(page.getByText(/Leave it blank/)).toBeVisible();

  // Skipped, deliberately: the account is still made and the panel on /account
  // remains the way to send it (issue #182, owner's decision).
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
});

test('an adult is never asked for a grown-up', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(30));
  await expect(page.getByLabel('A grown-up’s email')).toBeHidden();
});

test('a guardian address given at sign-up does not hold up the account', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Rosa Lindqvist');
  await page.getByLabel('Email', { exact: true }).fill(`e2e-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(11));
  await page.getByLabel('A grown-up’s email').fill(`guardian-${unique()}@landit.invalid`);

  // Local PocketBase has no mail account, so the request records and the send
  // fails. The rider must not be able to tell — a mailer we cannot reach is not
  // their sign-up failing.
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
});

test('a mistyped guardian address is caught before the account is made', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Tomas Vidal');
  await page.getByLabel('Email', { exact: true }).fill(`e2e-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(11));
  await page.getByLabel('A grown-up’s email').fill('mum@');

  // `type="email"` means the browser refuses the submit before any of our code
  // runs, so the rider gets the platform's own message and no account is made.
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/signup/);
  const valid = await page
    .getByLabel('A grown-up’s email')
    .evaluate((el) => (el as unknown as { checkValidity(): boolean }).checkValidity());
  expect(valid).toBe(false);

  // The server checks it again regardless — the browser is not the guard, it is
  // the courtesy. A posted form can carry anything.
});
