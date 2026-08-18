import { SPORTS, SPORT_IDS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

/**
 * The landing page (screenshots 01 and 02).
 *
 * The interesting assertion is the last one: the page never writes the sports
 * out, so a two-sport build says two and a three-sport build says three
 * without anyone editing this file or that one. It is the cheapest guard there
 * is against the two-sport assumption the plan keeps warning about (§7).
 */

test('the hero, the sample cards and the footer all render', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Every trick');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Proven.');

  // The four sample trick cards from the design pack.
  for (const name of ['Bunny Hop', 'Kickflip', 'Tailwhip', '50-50 Grind']) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }

  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy policy' })).toBeVisible();
});

test('every call to action goes somewhere real', async ({ page }) => {
  await page.goto('/');

  // These were disabled buttons until T6 built the pages behind them. T5 wrote
  // the test that way on purpose — it failed the moment sign-up landed, which
  // is what brought somebody here to change it.
  await expect(page.getByRole('link', { name: 'Start tracking, free' })).toHaveAttribute(
    'href',
    '/signup',
  );
  // The label carries a typographic apostrophe, so match on the tail of it.
  await expect(page.getByRole('link', { name: /got an account/ })).toHaveAttribute(
    'href',
    '/signin',
  );
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
});

test('the footer links to every legal document', async ({ page }) => {
  await page.goto('/');

  const footer = page.getByRole('contentinfo');
  for (const [name, href] of [
    ['Privacy policy', '/legal/privacy'],
    ['Terms of use', '/legal/terms'],
    ['Cookies', '/legal/cookies'],
    ['Safeguarding', '/legal/safeguarding'],
    ['About Land The Trick', '/legal/about'],
  ] as const) {
    await expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  }
});

/*
 * "A screen that is not built yet is a label, never a broken link" used to be a
 * test here, and it is gone because T15 landed the last unbuilt destination the
 * footer had.
 *
 * That is what its own comment asked for. It named "Trick library" until T7
 * built `/library` and "Plans and pricing" until T15 built `/plans`, and it
 * said: when nothing is unbuilt, the pattern has served its purpose and the
 * test can go with it. Every entry in `components/site/SiteFooter.tsx` now
 * carries an `href`.
 *
 * The *mechanism* survives and is still the right one: `FooterLink.href` is
 * optional, and an entry without one renders as plain text outside the tab
 * order rather than as a dead link (LESSONS §3a). A future session that adds a
 * destination before its screen exists should bring this test back, pointed at
 * whatever it added — that is cheaper than rediscovering why the field is
 * optional.
 */

test('a screen that has been built is a real link', async ({ page }) => {
  await page.goto('/');

  // The other half of the rule above, and the half that has no compile-time
  // guard: `typedRoutes` stops the footer pointing at a route that does not
  // exist, but nothing stops a built screen being left as a dead label for
  // waves after it shipped — which is exactly what had happened to both of
  // these until `chore-wire-wave4-links`.
  const footer = page.getByRole('contentinfo');
  for (const [name, href] of [
    ['Trick library', '/library'],
    ['Progress', '/progress'],
    // Wave 5's five, wired by `chore-wire-wave5-links` once all four sessions
    // had merged. Each shipped its screen reachable by URL and left this list
    // alone on purpose, so this assertion is the only thing standing between a
    // merged screen and a dead label.
    ['Stickers', '/stickers'],
    ['Events', '/events'],
    ['Spots', '/spots'],
    ['Crew', '/crew'],
    ['Weekly challenge', '/challenge'],
    // T15's. The footer is where a person deciding whether to sign up looks for
    // the price, so this is the one app screen that also reads signed out.
    ['Plans and pricing', '/plans'],
  ] as const) {
    await expect(footer.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  }
});

test('the sport copy is generated, so BMX needs no edit here', async ({ page }) => {
  await page.goto('/');

  // Whatever `SPORT_IDS` holds, the page names all of it and nothing else.
  for (const id of SPORT_IDS) {
    await expect(page.locator('body')).toContainText(SPORTS[id].label, { ignoreCase: true });
  }

  const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
  await expect(
    page.getByText(`${words[SPORT_IDS.length]} full libraries`, { exact: false }),
  ).toBeVisible();
});

/*
 * The other half of the page: who does *not* see it.
 *
 * `/` is the sales pitch, so a rider who is already signed in is sent to their
 * dashboard instead — the same rule `/signin` and `/signup` have always had.
 * The way riders actually hit it was the mark in their own top bar, which
 * pointed at `/` on every signed-in screen; that now points at the dashboard,
 * and the redirect below is the backstop for a bookmark or a typed address.
 *
 * The helper is a copy of the one in `progress.spec.ts` and three other specs.
 * Each file keeps its own rather than sharing one, which is this suite's
 * standing shape: the seed is global, the riders are not.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/** A signed-up, onboarded rider, landed on their dashboard. */
async function newRider(page: Page): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Landing Tester');
  await page.getByLabel('Email').fill(`e2e-landing-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await page.getByRole('button', { name: new RegExp(SPORTS.scooter.label, 'i') }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Just started/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Land my first trick' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "Let's go" }).click();
  await page.waitForURL('**/home');
}

test('a signed-in rider asking for the landing page gets their dashboard', async ({ page }) => {
  await newRider(page);

  await page.goto('/');
  await page.waitForURL('**/home');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alright, Landing.');
});

test('the mark in the top bar takes a signed-in rider to their dashboard', async ({ page }) => {
  await newRider(page);

  await page.goto('/progress');
  const mark = page.getByRole('link', { name: 'Land The Trick, home' });
  await expect(mark).toHaveAttribute('href', '/home');

  await mark.click();
  await page.waitForURL('**/home');
});

test('the mark still points at the landing page for a signed-out visitor', async ({ page }) => {
  // `/plans` is the one app screen that reads signed out, so it is the only
  // place the shell's top bar renders without a rider behind it.
  await page.goto('/plans');

  await expect(page.getByRole('link', { name: 'Land The Trick, home' })).toHaveAttribute(
    'href',
    '/',
  );
});
