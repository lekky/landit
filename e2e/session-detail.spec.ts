import { TRICKS, isTrickLocked, tricksFor } from '@landit/core';
import { createServerClient, createSession, setTrickStage } from '../packages/db/src/index';
import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';
import { POCKETBASE_URL, e2eSuperuser } from './support/seed-library';

/**
 * One session's page and the three page blocks (T39).
 *
 * What only this file checks:
 *
 *  - **The owner's page draws what the session holds**: the spot as the
 *    heading, the stage move on "What this one changed", and the clip as a
 *    link out — never an iframe, because a poster that embeds would contact a
 *    third party before the rider asked (plan §6.8).
 *  - **A signed-out visitor is sent to sign in**, not shown the session and not
 *    shown a 404 that would say whether the id exists.
 *  - **The spot and trick blocks are the rider's own and nobody else's**: they
 *    appear for the rider who logged there and are simply absent signed out.
 *
 * Sessions are written with the rider's own client (`createSession`), because
 * the hooks — the shape, the spot, the stage promotion — have no superuser
 * bypass and are what a real log goes through. The superuser only moves the
 * rider onto a plan that holds clips, which is a server-owned field.
 */

test.describe.configure({ mode: 'serial' });

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);
const trick = tricksFor('scooter', TRICKS).find((t) => !isTrickLocked(t, 'rookie'))!;

interface Seeded {
  sessionId: string;
  spotName: string;
  spotSlug: string;
}

let seeded: Seeded;
let email: string;

async function signUp(page: Page): Promise<string> {
  const now = new Date();
  const dob = new Date(Date.UTC(now.getUTCFullYear() - 24, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  const address = `e2e-session-${unique()}@landit.invalid`;

  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Session Rider');
  await page.getByLabel('Email').fill(address);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(dob);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  await finishOnboarding(page);
  await page.waitForURL('**/home');
  return address;
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/home');
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  email = await signUp(page);
  await page.close();

  const admin = await e2eSuperuser();
  const rider = await admin
    .collection('users')
    .getFirstListItem(admin.filter('email = {:email}', { email }), { fields: 'id' });
  await admin.collection('users').update(rider.id, { plan: 'shredder', timezone: 'Europe/London' });

  const spot = await admin
    .collection('spots')
    .getFirstListItem("status = 'live' && slug != ''", { sort: 'name' });
  const trickRow = await admin
    .collection('tricks')
    .getFirstListItem(admin.filter('slug = {:slug}', { slug: trick.id }));

  const client = createServerClient({ url: POCKETBASE_URL });
  await client.collection('users').authWithPassword(email, password);

  // Sometimes before the session, so the landing moves it to Most times.
  await setTrickStage(client, { userId: rider.id, trickId: trickRow.id, stage: 'some' });

  const session = await createSession(client, {
    userId: rider.id,
    timezone: 'Europe/London',
    input: {
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      durationMinutes: 120,
      sport: 'scooter',
      spotId: spot.id,
      aim: 'Round every one of them',
      feel: 'sent',
      weather: 'sun',
      notes: 'Warmed up on the quarter first.',
      clip: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      visibility: 'members',
      tricks: [{ trickId: trickRow.id, landed: true }],
    },
  });

  seeded = { sessionId: session.id, spotName: spot.name, spotSlug: spot.slug };
});

test('the owner sees the session, what it changed, and a clip that only links out', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/progress/sessions/${seeded.sessionId}`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(seeded.spotName);
  expect(await page.title()).toContain(seeded.spotName);

  // `getByRole` skips the copy of the card that is `display: none` at this
  // width (it is drawn once per breakpoint); `getByText` would not.
  await expect(page.getByRole('heading', { name: 'What this one changed' })).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: `${trick.name}: Sometimes → Most times` }),
  ).toBeVisible();

  const clip = page.getByRole('link', { name: 'Watch the clip on YouTube' });
  await expect(clip).toHaveAttribute('href', /youtube/);
  await expect(page.locator('iframe')).toHaveCount(0);

  await expect(page.getByRole('link', { name: 'Edit', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your crew can see this' })).toBeVisible();
});

test('a signed-out visitor is sent to sign in', async ({ page }) => {
  await page.goto(`/progress/sessions/${seeded.sessionId}`);
  await page.waitForURL(/\/signin\?next=/);
});

test('the spot block is the rider’s own, and absent signed out', async ({ browser, page }) => {
  await signIn(page);
  await page.goto(`/spots/${seeded.spotSlug}`);
  await expect(page.getByRole('heading', { name: 'Your sessions here' })).toBeVisible();
  await expect(page.getByText(/No other rider.s sessions show here/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log a session here' })).toHaveAttribute(
    'href',
    /\/progress\/sessions\/new\?spot=/,
  );

  const visitor = await browser.newPage();
  await visitor.goto(`/spots/${seeded.spotSlug}`);
  await expect(visitor.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(visitor.getByRole('heading', { name: 'Your sessions here' })).toHaveCount(0);
  await visitor.close();
});

test('the trick block counts the sessions that worked it', async ({ page }) => {
  await signIn(page);
  await page.goto(`/library/${trick.id}`);
  /*
   * Since T49 the block is the **first** row of the trick page's reading
   * column, which is where the 2026-09-13 instruction put it, and the row's own
   * heading and sub-line carry what the block's head used to: "Your sessions on
   * this trick" over "1 session · first tried 2 Sep". The block is still what
   * draws the rows; `heading={false}` is what stops the sentence appearing
   * twice, a line apart.
   */
  const row = page.getByRole('heading', { name: /Your sessions on this trick/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText('1 session · first tried');
  // First: nothing the page teaches comes before the part that is theirs.
  const lowdown = (await page.getByRole('heading', { name: 'The lowdown' }).boundingBox())!;
  expect((await row.boundingBox())!.y).toBeLessThan(lowdown.y);
});
