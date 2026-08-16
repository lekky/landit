import { TRICKS, isTrickLocked, tricksFor } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { e2eSuperuser } from './support/seed-library';

/**
 * Clips, on a paid plan (T14; plan §6.6, screenshot 09).
 *
 * `pocketbase/tests/clip-vault.test.ts` proves the cap and
 * `guarantee-2-clips.test.ts` proves the bytes never become public. Neither can
 * see the *screen*, and the screen is where the promise is kept or quietly
 * broken: what these assertions notice is a page that renders a clip's bytes
 * from a plain URL. The player's `src` has to carry a `token`, because a src
 * without one is either a 404 or — the day somebody makes the field public — a
 * clip anybody can watch.
 *
 * The rider is promoted with the superuser client rather than by paying, which
 * is the only way there is: `users.plan` is not writable by the account it
 * describes (plan §3), and Stripe is T15.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

const freeTrick = tricksFor('scooter', TRICKS).find((t) => !isTrickLocked(t, 'rookie'))!;

// One sign-up per test would be cheaper than one worker, but the file writes to
// one rider's vault across its tests, so they run in order.
test.describe.configure({ mode: 'default' });

/** The smallest thing PocketBase's mime allowlist accepts as `video/mp4`. */
function fakeMp4(bytes: number): Buffer {
  const ftyp = Buffer.concat([
    Buffer.from([0, 0, 0, 32]),
    Buffer.from('ftyp'),
    Buffer.from('mp42'),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('mp42isomavc1iso2'),
  ]);
  return Buffer.concat([ftyp, Buffer.alloc(Math.max(0, bytes - ftyp.length))]);
}

/** A new rider, signed up for real and then moved onto a paid plan from the server. */
async function signUpShredder(page: Page): Promise<void> {
  const now = new Date();
  const dob = new Date(Date.UTC(now.getUTCFullYear() - 24, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  const email = `e2e-clips-${unique()}@landit.invalid`;

  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Clip Rider');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(dob);
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Just started/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Land my first trick' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "Let's go" }).click();
  await page.waitForURL('**/home');

  const admin = await e2eSuperuser();
  const rider = await admin
    .collection('users')
    .getFirstListItem(admin.filter('email = {:email}', { email }));
  await admin.collection('users').update(rider.id, { plan: 'shredder' });
}

test('a paid rider saves a clip, plays it back through a token, and deletes it', async ({
  page,
}) => {
  await signUpShredder(page);
  await page.goto(`/library/${freeTrick.id}`);

  const panel = page.locator('.panel', { hasText: 'Your clips' }).first();
  await expect(panel).toContainText('Shredder');
  await expect(panel).toContainText('No clips yet');
  await expect(panel).toContainText('0MB of 2GB used');

  // The input is hidden behind "Add a clip", so the file goes to the input
  // directly — the button's only job is to open the picker.
  await panel.locator('input[type="file"]').setInputFiles({
    name: 'attempt.mp4',
    mimeType: 'video/mp4',
    buffer: fakeMp4(64 * 1024),
  });

  await expect(page.locator('.toast', { hasText: 'Clip saved' })).toBeVisible();
  const tile = panel.getByRole('button', { name: /^Play the clip/ });
  await expect(tile).toBeVisible();

  // Playback. The URL is minted on the press and carries a short-lived file
  // token: a `src` without one would mean the bytes are reachable without it,
  // which is exactly what guarantee 2 forbids.
  await tile.click();
  const player = page.locator('dialog, [role="dialog"]').locator('video');
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute('src', /[?&]token=[^&]+/);

  await page.keyboard.press('Escape');

  await panel.getByRole('button', { name: /^Delete the clip/ }).click();
  await expect(panel).toContainText('No clips yet');
  await expect(panel).toContainText('0MB of 2GB used');
});

test('a visitor with no vault is told what filming costs and is offered no upload', async ({
  page,
}) => {
  // The mirror of the test above, signed out. `library.spec.ts` has the same
  // check for a signed-up rookie; both would stop being true, silently, the day
  // the panel drew its state from the client rather than from the plan record.
  await page.goto(`/library/${freeTrick.id}`);

  const panel = page.locator('.panel', { hasText: 'Your clips' }).first();
  await expect(panel).toContainText('Filming your attempts is part of Shredder');
  await expect(panel.locator('input[type="file"]')).toHaveCount(0);
});
