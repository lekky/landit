import { SHREDDER_VIDEO_LINK_CAP, TRICKS, isTrickLocked, tricksFor } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { e2eSuperuser } from './support/seed-library';

/**
 * Video links on the trick page (T15b).
 *
 * **What this file exists for, and it is one thing above the others: proving
 * that nothing on the page talks to Google until the rider presses play.**
 *
 * Plan §6.8 runs Land It with **no consent banner** — cookie-less analytics,
 * self-hosted fonts, no cross-site anything — and that position is only honest
 * while no third party is contacted without the rider asking. An `<iframe>`
 * rendered on load, or a `img.youtube.com` thumbnail used as a poster, would put
 * a consent banner back on the roadmap for a product aimed at children, and
 * either is a one-line change somebody could make in good faith while
 * `youtube-nocookie` in the URL made it look handled. `youtube-nocookie` is a
 * promise about *cookies*; the request is the problem, and only a network
 * assertion notices.
 *
 * So the request counter below is the point of the file, and the rest — the cap
 * copy, the refusal on a bad link, the default visibility — is the ordinary
 * behaviour around it. Same shape as `spots.spec.ts`' geolocation counter, and
 * for the same reason: the guarantee is about a call that must not happen, and
 * you cannot assert an absence by reading the component.
 */

const scooterTricks = tricksFor('scooter', TRICKS);
const freeTrick = scooterTricks.find((t) => !isTrickLocked(t, 'rookie'))!;

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

/** A real YouTube id, never fetched — the player is only ever mounted, not played. */
const VIDEO = 'dQw4w9WgXcQ';

/**
 * Every host this page must not touch on load. Broad on purpose: the mistake
 * being guarded against is reaching for *any* Google-owned URL, and a list of
 * exact hostnames would miss the next one somebody picks.
 */
const GOOGLE =
  /(^|\.)(youtube|youtube-nocookie|youtu\.be|ytimg|googlevideo|google|gstatic|doubleclick)\./;

test.describe.configure({ mode: 'default' });

/** Sign up, then put the rider on a paid plan the way only the server can. */
async function signUpPaid(page: Page): Promise<void> {
  const now = new Date();
  const dob = new Date(Date.UTC(now.getUTCFullYear() - 24, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  const email = `e2e-video-${unique()}@landit.invalid`;

  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Video Rider');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(dob);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  await page
    .getByRole('button', { name: /^(Next|Done|Finish)/ })
    .first()
    .click();
  await page.waitForURL(/\/(home|onboarding)/);
  while (new URL(page.url()).pathname === '/onboarding') {
    await page
      .getByRole('button', { name: /^(Next|Done|Finish)/ })
      .first()
      .click();
    await page.waitForTimeout(150);
  }

  // `users.plan` is server-owned (`guardUserWrite` refuses a client that moves
  // it), so the only way onto a paid plan without a Stripe account is the
  // superuser client — the same door `docs/staff-accounts.md` describes. This is
  // the fixture, not a path the product offers.
  const admin = await e2eSuperuser();
  const rider = await admin
    .collection('users')
    .getFirstListItem(`email="${email}"`, { fields: 'id' });
  await admin.collection('users').update(rider.id, { plan: 'shredder' });
}

async function signUpRookie(page: Page): Promise<void> {
  const now = new Date();
  const dob = new Date(Date.UTC(now.getUTCFullYear() - 24, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Rookie Rider');
  await page.getByLabel('Email').fill(`e2e-video-r-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(dob);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  while (new URL(page.url()).pathname === '/onboarding') {
    await page
      .getByRole('button', { name: /^(Next|Done|Finish)/ })
      .first()
      .click();
    await page.waitForTimeout(150);
  }
}

const trickUrl = `/library/${freeTrick.id}`;

test('a paid rider adds a YouTube link and it starts private', async ({ page }) => {
  await signUpPaid(page);
  await page.goto(trickUrl);

  await expect(page.getByText('Your videos')).toBeVisible();
  await page.getByLabel('YouTube link').fill(`https://www.youtube.com/watch?v=${VIDEO}&t=30s`);
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // The tile appears, and the setting it appears with is the one the Children's
  // code asks for (plan §6.4 standard 7) — not "not public", the value itself.
  await expect(page.getByRole('button', { name: /^Play / })).toBeVisible();
  await expect(page.getByLabel('Who can see this video')).toHaveValue('private');
  await expect(page.getByText(`1 of ${SHREDDER_VIDEO_LINK_CAP} used`)).toBeVisible();
});

test('NOTHING reaches Google until the rider presses play', async ({ page }) => {
  await signUpPaid(page);
  await page.goto(trickUrl);
  await page.getByLabel('YouTube link').fill(`https://youtu.be/${VIDEO}`);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Play / })).toBeVisible();

  // Count from a cold load of the page that *has* the video on it, which is the
  // state the guarantee is about.
  const reached: string[] = [];
  page.on('request', (request) => {
    const host = new URL(request.url()).hostname;
    if (GOOGLE.test(`${host}.`)) reached.push(request.url());
  });

  await page.goto(trickUrl);
  await expect(page.getByRole('button', { name: /^Play / })).toBeVisible();
  // Give anything lazy a chance to fire before believing the absence.
  await page.waitForLoadState('networkidle');

  expect(reached, `page load contacted Google: ${reached.join(', ')}`).toEqual([]);
  // And no frame at all — a hidden iframe still loads, so the absence of the
  // element is the assertion, not its visibility.
  await expect(page.locator('iframe')).toHaveCount(0);

  // Then the click, which is the consent. The frame appears, pointed at the
  // no-cookie host, and now a request to Google is expected and fine.
  await page.getByRole('button', { name: /^Play / }).click();
  const frame = page.locator('iframe');
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute('src', new RegExp(`youtube-nocookie\\.com/embed/${VIDEO}`));
});

test('a rider changes who can see a video, and removes it', async ({ page }) => {
  await signUpPaid(page);
  await page.goto(trickUrl);
  await page.getByLabel('YouTube link').fill(VIDEO);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByLabel('Who can see this video')).toHaveValue('private');

  await page.getByLabel('Who can see this video').selectOption('members');
  await expect(page.getByLabel('Who can see this video')).toHaveValue('members');

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('button', { name: /^Play / })).toHaveCount(0);
  await expect(page.getByText(`0 of ${SHREDDER_VIDEO_LINK_CAP} used`)).toBeVisible();
});

test('a link that is not a YouTube link is refused, and says why', async ({ page }) => {
  await signUpPaid(page);
  await page.goto(trickUrl);

  await page.getByLabel('YouTube link').fill('https://vimeo.com/123456789');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(page.getByText(/does not look like a YouTube link/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Play / })).toHaveCount(0);
});

test('a rookie is told videos are a paid perk, and is given no form', async ({ page }) => {
  await signUpRookie(page);
  await page.goto(trickUrl);

  await expect(page.getByText(/Adding a video is part of the paid plans/i)).toBeVisible();
  await expect(page.getByLabel('YouTube link')).toHaveCount(0);

  // And the withdrawn vocabulary stays withdrawn. `library.spec.ts` holds the
  // same line for the whole page; this is the panel-shaped half of it, so a
  // future edit to this panel alone still trips something (plan §6.6).
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/\bclips?\b/i);
  expect(body).not.toMatch(/vault/i);
  expect(body).not.toMatch(/\bGB\b/i);
});

test('a signed-out visitor is offered no video surface at all', async ({ page }) => {
  await page.goto(trickUrl);

  await expect(page.getByRole('heading', { level: 1 })).toContainText(freeTrick.name);
  await expect(page.getByText('Your videos')).toHaveCount(0);
  await expect(page.getByLabel('YouTube link')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
});
