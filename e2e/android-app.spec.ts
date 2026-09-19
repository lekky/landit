import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';

/**
 * The checkout inside the Play Store app (T54, plan §2.4).
 *
 * **What this file exists for.** The Play listing is a Trusted Web Activity —
 * this same `/plans` screen, in the rider's own Chrome — and Google requires
 * Play Billing for a subscription bought inside an app it distributes. The
 * owner's decision (2026-09-18, in chat) was to withhold the purchase rather
 * than carry Play Billing, so the page has to be able to tell the two apart.
 *
 * It is asserted here rather than in a unit test because the answer is made of
 * two things only a browser has: a user agent and `display-mode`. It is also
 * the one behaviour in this change whose failure is not cosmetic — a checkout
 * that renders inside the store app is a policy breach, and a page nobody can
 * buy from on an ordinary Android phone is lost revenue. Both directions are
 * pinned below.
 *
 * **`display-mode` is emulated over CDP** (`Emulation.setEmulatedMedia`),
 * because Playwright's own `emulateMedia` covers colour scheme and print and
 * not this. Chromium-only, which is what this project runs.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

/** The marker the withheld card carries. */
const WITHHELD = 'is not sold here';

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

/**
 * A rider old enough to pay for their own plan.
 *
 * Signed in and 24, because the gate only ever renders over a *buyable* card:
 * signed out there is no form to withhold (the card offers an account), and a
 * rider behind the consent gate already gets "Waiting on a grown-up" from §6.2.
 */
async function signUpAdult(page: Page): Promise<void> {
  const now = new Date();
  const dob = new Date(Date.UTC(now.getUTCFullYear() - 24, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Android Rider');
  await page.getByLabel('Email').fill(`e2e-android-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(dob);
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await finishOnboarding(page);
  await page.waitForURL('**/home');
}

/**
 * Tell the page it is running as an installed app rather than in a tab.
 *
 * **Called after the navigation, not before**, which is not a style choice:
 * Playwright re-applies its own emulation state on every navigation and wipes
 * a `features` override set beforehand. A first draft of this file emulated
 * first and navigated second, and the standalone test passed against a page
 * that was never standalone — it asserted nothing, silently.
 *
 * Applying it to a page that has already loaded exercises something real as
 * well: the gate subscribes to `display-mode` changing, because Chrome can
 * hand a tab to the installed app mid-session. This is that path.
 */
async function emulateStandalone(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'display-mode', value: 'standalone' }],
  });
}

test.describe('on Android', () => {
  test.use({ userAgent: ANDROID_UA });

  test('a rider in an ordinary tab is still sold a plan', async ({ page }) => {
    await signUpAdult(page);
    await page.goto('/plans');

    const shredder = page.locator('[data-plan="shredder"]');
    // The card decides this in the browser, so the button arrives a beat after
    // the HTML — which is the documented cost of failing towards withholding.
    await expect(shredder.getByRole('button', { name: /Get Shredder/ })).toBeVisible();
    await expect(shredder).not.toContainText(WITHHELD);
  });

  test('a rider inside the installed app is not (plan §2.4)', async ({ page }) => {
    await signUpAdult(page);
    await page.goto('/plans');
    await emulateStandalone(page);

    const shredder = page.locator('[data-plan="shredder"]');
    await expect(shredder).toContainText(WITHHELD);

    // The point of the whole change: no purchase, by any route. Not a disabled
    // button that enables, and not a link out to a payment page — the second
    // is the "steering" the same policy is about.
    await expect(shredder.getByRole('button', { name: /Get Shredder/ })).toHaveCount(0);
    await expect(shredder.locator('input[name="confirm_adult"]')).toHaveCount(0);
    await expect(shredder.locator('form')).toHaveCount(0);
  });

  test('what a plan is and what it costs are still shown', async ({ page }) => {
    // Withholding the purchase is not withholding the information: a rider who
    // cannot buy here should still learn what the tiers are, so that the
    // website is a decision they can make rather than one they have to
    // discover.
    await signUpAdult(page);
    await page.goto('/plans');
    await emulateStandalone(page);

    const shredder = page.locator('[data-plan="shredder"]');
    await expect(shredder).toContainText('Shredder');
    await expect(shredder).toContainText('£3.99');
  });
});

test.describe('everywhere else', () => {
  test('an installed app on a laptop keeps its checkout, because Play does not distribute it', async ({
    page,
  }) => {
    // The gate is Android-only by construction: `plans/page.tsx` decides that
    // on the server, and off Android the form is rendered untouched. A desktop
    // PWA install is not a Play app and nothing about it is Google's to rule
    // on — this is the assertion that stops the gate quietly widening to every
    // installed surface.
    await signUpAdult(page);
    await page.goto('/plans');
    await emulateStandalone(page);

    const shredder = page.locator('[data-plan="shredder"]');
    await expect(shredder.getByRole('button', { name: /Get Shredder/ })).toBeVisible();
    await expect(shredder).not.toContainText(WITHHELD);
  });
});
