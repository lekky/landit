import { SPORTS, SPORT_IDS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { seedLibrary } from './support/seed-library';
import { seedSchedule } from './support/seed-schedule';

/**
 * Events (T12), for a rider on the free plan.
 *
 * Three things worth pinning to the rendered page:
 *
 * - **"I'm going" survives a reload**, which is the difference between a row in
 *   `event_attendance` and a `useState`.
 * - **A past event is hidden by default and can be brought back**, rather than
 *   dropped. A row a child ticked that silently disappears reads as a bug.
 * - **A visitor who is not signed in reads the whole calendar**, because the
 *   `events` rule is `is_live = true` with no auth arm and a live event is
 *   public data. Only "I'm going" needs an account, and it is a sign-in link
 *   rather than a button that fails on click.
 * - **Nobody else's attendance is anywhere on the page.** There is no
 *   stranger-contact surface in this product (plan §6.1), and "who else is
 *   going" would be one. This is the kind of decision that gets added back by
 *   somebody who thinks it would be nice, so it is asserted rather than assumed.
 *
 * The events are seeded by the spec around today — see `seed-schedule.ts`.
 */

/*
 * The browser globals the geolocation tests below run against. This project's
 * e2e tsconfig has no DOM lib (see `shell.spec.ts`), and a call that is
 * supposed *never* to happen has to be observed at the API it would have gone
 * through. Declared narrowly, as types only — `declare` erases.
 */
declare const window: { __geoCalls: number };
declare const navigator: object;

interface StubPosition {
  coords: { latitude: number; longitude: number; accuracy: number };
  timestamp: number;
}

test.describe.configure({ mode: 'default' });

test.beforeAll(async () => {
  await seedLibrary();
  await seedSchedule();
});

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

async function newRider(page: Page): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Events Tester');
  await page.getByLabel('Email').fill(`e2e-events-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  for (const sport of SPORT_IDS) {
    await page.getByRole('button', { name: new RegExp(SPORTS[sport].label, 'i') }).click();
  }
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Just started/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Land my first trick' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "Let's go" }).click();
  await page.waitForURL('**/home');
}

/**
 * Replace the geolocation API with something that counts, before any of the
 * page's own script runs — so a call made during hydration is caught too.
 */
async function watchGeolocation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (position: StubPosition) => void) => {
          window.__geoCalls += 1;
          ok({
            coords: { latitude: 53.4084, longitude: -2.9916, accuracy: 40 },
            timestamp: Date.now(),
          });
        },
        watchPosition: () => {
          throw new Error('watchPosition must never be used: it is a live tracking session.');
        },
        clearWatch: () => {},
      },
    });
  });
}

const geoCalls = (page: Page) => page.evaluate(() => window.__geoCalls);

test('the list shows an upcoming event with its date block and its details', async ({ page }) => {
  await newRider(page);
  await page.goto('/events');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('What’s coming up');
  await expect(page.getByText('E2E Northern Jam')).toBeVisible();
  await expect(page.getByText('Projekts MCR · Manchester · All levels')).toBeVisible();

  await page.getByRole('button', { name: 'Details' }).first().click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Where', { exact: true })).toBeVisible();
  await expect(modal.getByText('Projekts MCR, Manchester')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});

test('"I’m going" sticks across a reload', async ({ page }) => {
  await newRider(page);
  await page.goto('/events');

  // Only the one upcoming event is on the list by default, so this is unambiguous.
  await expect(page.getByText('E2E Northern Jam')).toBeVisible();
  await page.getByRole('button', { name: "I'm going" }).click();
  await expect(page.getByRole('button', { name: '✓ Going' })).toBeVisible({ timeout: 15_000 });

  // The toast fires only after `setAttendanceAction` resolves (EventsScreen's
  // startTransition awaits it), so it is the one signal on this screen the
  // server produced — the ✓ label above and the tally below are optimistic
  // client state. Waiting here means the reload cannot abort the write in
  // flight, which is what made this test flaky under local parallelism
  // (issue #121). Straight apostrophe: the toast string, not the JSX &rsquo;.
  await expect(page.getByText("You're down for E2E Northern Jam.")).toBeVisible({
    timeout: 15_000,
  });

  await page.reload();
  await expect(page.getByRole('button', { name: '✓ Going' })).toBeVisible();
  await expect(page.getByText(/You’re down for 1 event/)).toBeVisible();
});

test('an event that has been and gone is hidden until it is asked for', async ({ page }) => {
  await newRider(page);
  await page.goto('/events');

  await expect(page.getByText('E2E Last Month Session')).toHaveCount(0);

  // "Upcoming only" is the state the page lands in and is now drawn as such;
  // the pill that changes it is the other one.
  await page.getByRole('button', { name: 'Including past' }).click();
  await expect(page.getByText('E2E Last Month Session')).toBeVisible();
  await expect(page.getByText('Been and gone')).toBeVisible();
});

test('the kind filter narrows the list and every pill finds something', async ({ page }) => {
  await newRider(page);
  await page.goto('/events');

  // "Including past", so both seeded kinds are in scope for the pills.
  await page.getByRole('button', { name: 'Including past' }).click();

  await page.getByRole('button', { name: 'Session', exact: true }).click();
  await expect(page.getByText('E2E Last Month Session')).toBeVisible();
  await expect(page.getByText('E2E Northern Jam')).toHaveCount(0);

  await page.getByRole('button', { name: 'Everything' }).click();
  await expect(page.getByText('E2E Northern Jam')).toBeVisible();
});

test('no other rider appears anywhere on the events screen', async ({ page }) => {
  await newRider(page);
  await page.goto('/events');

  // Plan §6.1: no discovery, no directory, no way to see who else is going.
  await expect(page.getByText(/going with/i)).toHaveCount(0);
  await expect(page.getByText(/riders going/i)).toHaveCount(0);
  await expect(page.getByText(/attendees/i)).toHaveCount(0);
});

test('a visitor who is not signed in reads the whole calendar', async ({ page }) => {
  // Deliberately no `newRider`. This is the anonymous read, which is the API
  // rule's doing rather than the page's — `events` is `is_live = true` with no
  // auth arm, like `spots`, and unlike `announcements` beside it.
  await page.goto('/events');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('What’s coming up');
  await expect(page.getByText('E2E Northern Jam')).toBeVisible();

  // Every filter still works without an account.
  await page.getByRole('button', { name: 'Including past' }).click();
  await expect(page.getByText('E2E Last Month Session')).toBeVisible();
});

test('a visitor is offered sign-in where a rider is offered "I’m going"', async ({ page }) => {
  await page.goto('/events');

  // The one control that needs an account is a link back to this page, not a
  // button that looks live and loses the rider's filters on click.
  const link = page.getByRole('link', { name: 'Sign in to save' }).first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', `/signin?next=${encodeURIComponent('/events')}`);
  await expect(page.getByRole('button', { name: "I'm going" })).toHaveCount(0);

  await link.click();
  await page.waitForURL('**/signin?next=*');
});

/*
 * Children's code standard 10 (plan §6.4), on the calendar. Signed out, because
 * nothing here needs an account and the promise is owed to a visitor too.
 *
 * Neither test asserts the *order* of the list: the seeded events carry no
 * coordinates, so the screen keeps them in date order by its own rule about
 * events nobody has plotted. What is asserted is the part the resume changed —
 * that a position is taken only when the browser already allows it, that the
 * rider is told both that their location is in use and that the ordering has
 * changed, and that they can end it.
 */
test('the calendar never asks for the rider’s location unless they press for it', async ({
  page,
}) => {
  await watchGeolocation(page);
  await page.goto('/events');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('What’s coming up');

  // No permission granted to this context, so the load-time resume must decline
  // to act: on a browser sitting at `prompt`, a `getCurrentPosition` call *is*
  // the permission dialog. Checked before hydration is waited for, on purpose.
  expect(await geoCalls(page)).toBe(0);

  const pill = page.getByRole('button', { name: 'Sort by nearest' });
  await expect(pill).toBeVisible();
  await expect(page.getByText('Nearest first')).toHaveCount(0);

  await pill.click();
  expect(await geoCalls(page)).toBe(1);
  await expect(page.getByText('Using your location')).toBeVisible();
  await expect(page.getByText('Nearest first')).toBeVisible();

  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByText('Using your location')).toHaveCount(0);
  await expect(page.getByText('Nearest first')).toHaveCount(0);
});

test('the calendar opens nearest-first when the browser already allows it', async ({
  page,
  context,
}) => {
  // The rider granted this in their own browser on an earlier visit, which is
  // the only state the resume acts on (§6.4 standard 10, as amended).
  await context.grantPermissions(['geolocation']);
  await watchGeolocation(page);
  await page.goto('/events');

  // No press anywhere in this test. Both notices are the assertion: a calendar
  // silently re-sorted from date order owes the rider the second one.
  await expect(page.getByText('Using your location')).toBeVisible();
  await expect(page.getByText('Nearest first')).toBeVisible();
  expect(await geoCalls(page)).toBe(1);

  // Still switches off for good — the permission is still granted, so a resume
  // that ignored the press would come straight back and leave the rider unable
  // to turn their location off at all.
  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByText('Using your location')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sort by nearest' })).toBeVisible();
  expect(await geoCalls(page)).toBe(1);
});
