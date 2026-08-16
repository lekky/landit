import { SPORTS, SPORT_IDS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

/**
 * Sign-up, onboarding and the guardian-consent flow (T6), against a real
 * PocketBase — see `playwright.config.ts` for why it is on its own port and its
 * own database.
 *
 * The assertion this file exists for is the third one: **the date of birth never
 * leaves the browser**. Everything else here could be re-derived from the unit
 * and API tests; that one can only be observed where the form actually is.
 *
 * What is deliberately *not* tested: the emails. There is no mail account and no
 * verified sending domain yet (`docs/infrastructure.md`), so nothing can be
 * delivered, and a test that asserted on a message nobody can send would be
 * asserting on a mock of our own making.
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

test('sign up, onboard and land on an account', async ({ page }) => {
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
  await page.getByRole('button', { name: "Let's go" }).click();

  await page.waitForURL('**/account');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Miles Carter');
  // The gate does not apply to this rider, so the guardian panel is absent.
  await expect(page.getByText('a grown-up needs to say yes')).toBeHidden();

  // Onboarding is done, so going back to it does not start again.
  await page.goto('/onboarding');
  await page.waitForURL('**/account');
});

test('a younger rider arrives at an account that says what it is waiting for', async ({ page }) => {
  const email = `e2e-${unique()}@landit.invalid`;
  await fillSignUp(page, { name: 'Nia Okafor', email, country: 'GB', dob: birthDate(11) });
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Just started/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Land my first trick' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "Let's go" }).click();

  await page.waitForURL('**/account');
  await expect(page.getByText(/a grown-up needs to say yes/i)).toBeVisible();
  // What they can do comes first, and it is most of the product.
  await expect(page.getByText('Log every trick you land')).toBeVisible();
  await expect(page.getByText('Join or start a crew')).toBeVisible();

  await page.getByLabel(/parent or carer/i).fill('guardian@landit.invalid');
  await page.getByRole('button', { name: 'Ask them' }).click();
  await expect(page.getByText(/We have written to guardian@landit.invalid/)).toBeVisible();
  // No mail provider is configured, and the screen says so rather than pretending.
  await expect(page.getByText(/not switched on until launch/i)).toBeVisible();
});

test('a guardian link that is not valid says so, and offers a way out', async ({ page }) => {
  await page.goto('/consent/approve/not-a-real-token');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('That link is not valid');
  await expect(page.getByText(/safeguarding@landit.app/)).toBeVisible();
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

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Just started/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Land my first trick' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "Let's go" }).click();
  await page.waitForURL('**/account');

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
  await page.goto('/signin');
  await page.getByLabel('Email').fill(`nobody-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('That email and password do not match an account')).toBeVisible();
});
