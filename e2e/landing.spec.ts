import { PLANS, SPORTS, SPORT_IDS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

/**
 * The landing page — "the wall" (design pack `design_handoff_landing_wall`).
 *
 * Rewritten wholesale when the page was: the old spec named a headline, four
 * sample trick cards and two calls to action that no longer exist. What
 * survives is its best idea — asserting that the sports are *generated* rather
 * than typed, so a build that gains a sport says so without anyone editing
 * this file. The equivalents here are the price and the vinyl assertions: both
 * check that page copy is derived from `PLANS` rather than written down beside
 * it, which is the failure mode that puts a wrong price in front of a customer.
 */

test('the hero renders, headline through to the footer', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Track your progress and');
  // The wordmark is the second half of that sentence, so it carries alt text
  // rather than being decorative.
  await expect(page.getByAltText('land the trick')).toBeVisible();

  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy policy' })).toBeVisible();
});

test('the two peeks go somewhere a stranger can actually read', async ({ page }) => {
  await page.goto('/');

  // The whole argument of the hero: these need no account, and both screens
  // really do read signed out. A redirect to /signin here is the regression.
  for (const [name, href] of [
    [/Browse the spots/, '/spots'],
    [/What.s on/, '/events'],
  ] as const) {
    await expect(page.getByRole('link', { name })).toHaveAttribute('href', href);
  }

  await page.getByRole('link', { name: /Browse the spots/ }).click();
  await page.waitForURL('**/spots');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('every call to action goes somewhere real', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'Start free' })).toHaveAttribute('href', '/signup');
  await expect(page.getByRole('link', { name: 'Start my wall' })).toHaveAttribute(
    'href',
    '/signup',
  );
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
});

test('the hero email carries into sign-up, and never through the URL', async ({ page }) => {
  await page.goto('/');

  const email = 'hero-handoff@landit.invalid';
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Get started — free' }).click();

  await page.waitForURL('**/signup');
  // The address arrived...
  await expect(page.getByLabel('Email')).toHaveValue(email);
  // ...and not in the query string, where it would land in history, in a
  // referrer and in any log that records paths (`lib/signupHandoff.ts`).
  expect(page.url()).not.toContain(email);
  expect(new URL(page.url()).search).toBe('');
});

test('the season grid shows real tricks, and a sticker only on a landed one', async ({ page }) => {
  await page.goto('/');

  const grid = page.getByRole('heading', { name: 'One rider, one season' });
  await expect(grid).toBeVisible();

  // The caption the design pack requires, near enough verbatim: the sale of a
  // sticker is the one thing the product promises never to do.
  await expect(page.getByText(/never for sale, on any plan/i)).toBeVisible();
  await expect(page.getByText(/An example season/i)).toBeVisible();

  // Earned badges carry their award's name in the alt text; a "Not tracked"
  // tile must not have one.
  await expect(page.locator('img[alt*="sticker, earned"]').first()).toBeAttached();
});

test('the FAQ quotes the price the product actually charges', async ({ page }) => {
  await page.goto('/');

  // Derived from `PLANS`, not typed into the page — so a price change in one
  // place cannot leave the marketing copy quoting the old one at a customer.
  for (const id of ['shredder', 'legend'] as const) {
    const plan = PLANS.find((p) => p.id === id)!;
    const price = `£${(plan.priceMonthlyPence / 100).toFixed(2)}`;
    await expect(page.getByText(price, { exact: false }).first()).toBeVisible();
  }
});

test('the page does not promise vinyl stickers in the post', async ({ page }) => {
  await page.goto('/');

  /*
   * Issue #181: the product does not post stickers out, and the design pack's
   * FAQ said Legend does. Dropped on the owner's instruction (2026-09-04, in
   * chat) rather than shipped onto a live page with a live checkout behind it.
   *
   * Asserted rather than trusted, because this is a claim about what a
   * customer gets for money and the pack's wording is one paste away from
   * coming back.
   */
  await expect(page.getByText(/vinyl/i)).toHaveCount(0);
  await expect(page.getByText(/in the post/i)).toHaveCount(0);
});

test('the sport copy is generated, so a new sport needs no edit here', async ({ page }) => {
  await page.goto('/');

  for (const id of SPORT_IDS) {
    await expect(page.locator('body')).toContainText(SPORTS[id].label, { ignoreCase: true });
  }
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
