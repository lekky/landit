import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';

/**
 * Favourite spots, end to end (2026-09-13, owner in chat).
 *
 * The whole of what the owner asked for is one loop — fave a spot, see your
 * faves, remove one — and every step of it crosses a boundary the unit tests
 * cannot: an optimistic star, a filter that appears only once there is
 * something behind it, a list that is drawn from the rider's own cards rather
 * than from the server's page, and a filter that lets go of itself when the
 * last fave goes.
 *
 * **The privacy half is not here, and that is deliberate.** That a rider cannot
 * see or touch another rider's faves is proven over HTTP in
 * `pocketbase/tests/spot-favourites.test.ts`, which is where a guarantee about
 * what the *server* refuses belongs — a browser spec can only ever show that
 * this screen does not ask.
 *
 * Signed out there is no star at all, which is the one thing about the control
 * a signed-out visit can check, so `spots.spec.ts`' visitor keeps that job by
 * never seeing one.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

/** A brand new rider, through the real sign-up and the real onboarding. */
async function signUp(page: Page): Promise<void> {
  const now = new Date();
  const dob = new Date(Date.UTC(now.getUTCFullYear() - 24, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Fave Rider');
  await page.getByLabel('Email').fill(`e2e-fave-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(dob);
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await finishOnboarding(page);
  await page.waitForURL('**/home');
}

/** Every star on the list, in card order. */
const stars = (page: Page) => page.getByRole('button', { name: /^Fave / });

/*
 * The filter pill, and only it. Matched on the front of its label rather than
 * on "faves", because a filled star says "Remove <spot> from your faves" and a
 * looser locator finds both.
 */
const favesPill = (page: Page) => page.getByRole('button', { name: /^Show(ing)? your faves/ });

test.describe('faving a spot', () => {
  test('fills the star, offers a Faves filter, and empties it again', async ({ page }) => {
    await signUp(page);
    await page.goto('/spots');

    /*
     * No pill before there is anything behind it. Asserted first, because it is
     * the thing a returning rider sees and the easiest to regress into an
     * always-on "Faves (0)".
     */
    await expect(favesPill(page)).toHaveCount(0);

    const first = stars(page).first();
    await expect(first).toBeVisible();
    // The name of the card the star is on, so the assertions below can follow
    // that one spot through the filter rather than trusting the order.
    const label = (await first.getAttribute('aria-label')) ?? '';
    const spotName = label.replace(/^Fave /, '');
    expect(spotName).not.toBe('');

    await first.click();

    // Optimistic: the star reports itself pressed without waiting on a round
    // trip, and its label flips to the way back out.
    await expect(
      page.getByRole('button', { name: `Remove ${spotName} from your faves` }),
    ).toHaveAttribute('aria-pressed', 'true');

    // And the filter arrives, because now there is something behind it.
    await expect(favesPill(page)).toBeVisible();

    await favesPill(page).click();
    await expect(page.getByText('1 spot in your faves')).toBeVisible();
    // One card, and it is the one that was starred: no unfilled star is left
    // on the screen, and the filled one names the spot.
    await expect(stars(page)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: `Remove ${spotName} from your faves` }),
    ).toBeVisible();

    /*
     * Removing the last one inside the faves view: the filter has to let go of
     * itself rather than leave the rider looking at an empty list with no
     * obvious way out, and the pill has to go with it.
     */
    await page.getByRole('button', { name: `Remove ${spotName} from your faves` }).click();
    await expect(favesPill(page)).toHaveCount(0);
    await expect(stars(page).first()).toBeVisible();
  });

  test('survives a reload, which is the whole point of a fave', async ({ page }) => {
    await signUp(page);
    await page.goto('/spots');

    const first = stars(page).first();
    await expect(first).toBeVisible();
    const spotName = ((await first.getAttribute('aria-label')) ?? '').replace(/^Fave /, '');
    await first.click();
    await expect(favesPill(page)).toBeVisible();

    await page.reload();

    // Read back from the server, not from anything kept in the browser: the
    // star is already filled on the first paint a rider sees.
    await expect(favesPill(page)).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Remove ${spotName} from your faves` }),
    ).toBeVisible();
  });

  test('is offered on a spot’s own page, and agrees with the list', async ({ page }) => {
    await signUp(page);
    await page.goto('/spots');

    const card = page.getByRole('link', { name: /open spot page$/ }).first();
    await expect(card).toBeVisible();
    await card.click();
    await page.waitForURL(/\/spots\/[a-z0-9-]+$/);

    const fave = page.getByRole('button', { name: 'Fave', exact: true });
    await expect(fave).toBeVisible();
    await expect(fave).toHaveAttribute('aria-pressed', 'false');
    await fave.click();
    await expect(page.getByRole('button', { name: 'Faved', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // The list is the other half of the same state, so it has to agree.
    await page.goto('/spots');
    await expect(favesPill(page)).toBeVisible();
  });

  test('shows a signed-out visitor no star at all', async ({ page }) => {
    // Not a sign-in invitation on every card: `/spots` already has one control
    // that does that job, and twenty-four more would be twenty-four ways off
    // the page.
    await page.goto('/spots');
    await expect(stars(page)).toHaveCount(0);
    await expect(favesPill(page)).toHaveCount(0);
  });
});
