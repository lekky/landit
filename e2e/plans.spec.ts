import { PLANS, sessionAllowance, sessionsPerMonthPerk } from '@landit/core';
import { expect, test } from '@playwright/test';

/**
 * Membership (T15; screenshot 20, plan §2.4, §6.2 and §6.7).
 *
 * **This file exists mostly to pin copy decisions**, which is the same job
 * `legal.spec.ts` does and for the same reason: a rewrite is one careless edit
 * away from coming back, and none of these fails a build on its own
 * (LESSONS §3a). Three decisions are asserted against the rendered page, each
 * with its plan section in the test name:
 *
 * - the third card is **Legend**, a single rider, not the prototype's five-seat
 *   Crew Pass (§2.4, dropped 2026-08-15)
 * - **achievements are never for sale** (§1, §2.4) — the FAQ says so in words,
 *   and no card sells a sticker or a stage
 * - **the payer is an adult** (§6.2) — the page says a parent can pay and that
 *   under 16 it is the only way
 *
 * **It runs signed out.** `/plans` is the one screen in the app group that
 * does, because the site footer links it and somebody deciding whether to sign
 * up should not have to sign up to find out what it costs. That also makes this
 * the cheapest possible spec: no rider, no seeding beyond the `plans` records
 * `global-setup.ts` already writes.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/plans');
});

test('the three cards are the plan’s three, and the top one is Legend not Crew Pass (§2.4)', async ({
  page,
}) => {
  for (const plan of PLANS) {
    await expect(page.locator(`[data-plan="${plan.id}"]`)).toBeVisible();
  }
  await expect(page.locator('[data-plan]')).toHaveCount(PLANS.length);

  // The prototype's third card. It was dropped on 2026-08-15 along with its
  // seat model, and the word must not come back anywhere on this page.
  await expect(page.locator('body')).not.toContainText('Crew Pass');
  await expect(page.locator('[data-plan="legend"]')).toContainText('Legend');
});

test('every card carries its session line, derived from its own record (#507)', async ({
  page,
}) => {
  /*
   * The end-to-end half of `sessionCardPerks`. Its unit tests prove the pure
   * function; only a browser proves the wiring — that the line is read off the
   * `plans` record the page fetched, appended to the perks that record holds,
   * and rendered on the right card.
   *
   * It runs here because the e2e server sets `LANDIT_SESSIONS_OPEN=1`
   * (`sessionsPreview.ts`), which is exactly the state the cards ship in once
   * sessions are released. With the flag unset the lines are absent by design,
   * and that half is asserted in the unit tests rather than by standing a
   * second server up.
   */
  for (const plan of PLANS) {
    const line = sessionsPerMonthPerk(sessionAllowance(plan));
    if (line === null) continue;
    await expect(page.locator(`[data-plan="${plan.id}"]`)).toContainText(line);
  }

  // Rookie's cap is the one a rider meets, so it is named rather than derived:
  // if the free tier's four ever moves, this fails and somebody decides on
  // purpose whether the card should follow.
  await expect(page.locator('[data-plan="rookie"]')).toContainText('Four sessions a month');
  await expect(page.locator('[data-plan="shredder"]')).toContainText('Unlimited sessions');
});

test('no plan card says "clip", whatever the comparison table says (plan §6.6)', async ({
  page,
}) => {
  // We hold a link; we do not hold the video. The word belongs to the "Clip
  // links" row of the comparison below, where the header gives it context — a
  // lone bullet reading "10 clip links" on a card does not. `data.test.ts`,
  // `video.test.ts` and `sessionPlanRows.test.ts` hold the same line in code;
  // this holds it on the rendered card, which is where a rider reads it.
  for (const plan of PLANS) {
    await expect(page.locator(`[data-plan="${plan.id}"]`)).not.toContainText(/clip|vault|upload/i);
  }
});

test('Shredder is the raised "Most riders" card (screenshot 20)', async ({ page }) => {
  const shredder = page.locator('[data-plan="shredder"]');
  await expect(shredder).toContainText('Most riders');
  await expect(page.getByText('Most riders')).toHaveCount(1);
});

test('the prices are plan §6.7’s, and the toggle switches every card at once', async ({ page }) => {
  const shredder = page.locator('[data-plan="shredder"]');
  const legend = page.locator('[data-plan="legend"]');
  const rookie = page.locator('[data-plan="rookie"]');

  await expect(shredder).toContainText('£3.99');
  await expect(shredder).toContainText('per month');
  await expect(legend).toContainText('£6.99');
  // The free tier is not a trial and has no period, whichever way the toggle
  // is set.
  await expect(rookie).toContainText('Free');
  await expect(rookie).toContainText('forever');

  await page.getByRole('button', { name: 'Yearly', exact: true }).click();

  await expect(shredder).toContainText('£39.99');
  await expect(shredder).toContainText('per year');
  await expect(legend).toContainText('£69.99');
  await expect(rookie).toContainText('Free');
  await expect(rookie).toContainText('forever');
});

test('the yearly saving badge is derived, not typed (LESSONS §4)', async ({ page }) => {
  // `yearlySavingLabel` computes this from the two prices, so it cannot outlive
  // a price change. If §6.7 moves and this fails, the badge was right and the
  // test is what needs repointing.
  await expect(page.getByText('2 months free', { exact: true })).toBeVisible();
});

test('the saving belongs to Yearly, and says so to a screen reader', async ({ page }) => {
  // The badge used to sit beside the whole toggle, where a visitor on the
  // default Monthly reads it as describing Monthly. It is now anchored to the
  // Yearly button; position carries that for a sighted reader and
  // `aria-describedby` carries it for everyone else. A layout change that
  // detaches the two fails here.
  const yearly = page.getByRole('button', { name: 'Yearly', exact: true });
  await expect(yearly).toHaveAccessibleDescription('2 months free');
  await expect(
    page.getByRole('button', { name: 'Monthly', exact: true }),
  ).toHaveAccessibleDescription('');
});

test('achievements are never for sale, and the page says so (plan §1, §2.4)', async ({ page }) => {
  const faq = page.getByText('Do stickers come faster on a paid plan?');
  await expect(faq).toBeVisible();
  await expect(page.locator('body')).toContainText('none of them is ever for sale');

  // The other half, and the one a copy edit could undo without touching the
  // FAQ: no card may sell a sticker or a stage. Paid tiers sell capacity,
  // cosmetics and insight.
  for (const slug of ['shredder', 'legend']) {
    const card = page.locator(`[data-plan="${slug}"]`);
    await expect(card).not.toContainText('sticker', { ignoreCase: true });
  }
});

test('the payer is an adult, and under 16 a guardian pays (plan §6.2)', async ({ page }) => {
  await expect(page.getByText('Can a parent pay?')).toBeVisible();
  await expect(page.locator('body')).toContainText('under 16');
  await expect(page.locator('body')).toContainText('18 or over');
});

test('a signed-out visitor is offered an account, never a payment form', async ({ page }) => {
  // *Every* card's call to action goes to sign-up: there is nothing to attach a
  // subscription to yet, and a checkout that started here would have no rider.
  // The count matters — `currentPlanSlug` falls back to `rookie` for a visitor,
  // so a card that read "Your plan" would be telling a stranger they are on one.
  const signUp = page.getByRole('link', { name: 'Start on Rookie' });
  await expect(signUp).toHaveCount(3);
  await expect(signUp.first()).toHaveAttribute('href', '/signup');
  await expect(page.locator('body')).not.toContainText('Your plan');

  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Get / })).toHaveCount(0);
});

test('the free tier is described as free rather than as a trial', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('isn’t a trial');
  await expect(page.getByText('Does the free tier expire?')).toBeVisible();
});

/**
 * Whose currency the prices are in (issue #170).
 *
 * Every price in the product is GBP and a Stripe price is created in one
 * currency, so a parent in Dublin or Toronto is already able to buy — they are
 * simply not told the charge lands in pounds until Stripe's checkout, and not
 * told about the conversion until their statement. The note says it on the
 * page instead. Multi-currency itself is still #170's, and is a tax position
 * rather than a formatting change.
 *
 * Both branches are pinned here because the decision is which reader sees it,
 * and that is exactly the sort of thing a later edit reverses by accident. The
 * locale is the only signal a signed-out visitor gives — Playwright's `locale`
 * sets `Accept-Language`, which is what `page.tsx` resolves the country from.
 */
test.describe('the GBP note', () => {
  test.describe('for a reader outside the UK', () => {
    test.use({ locale: 'fr-FR' });

    test('says the prices are sterling before they press anything', async ({ page }) => {
      await expect(page.locator('body')).toContainText('Prices are in pounds sterling');
      await expect(page.locator('body')).toContainText('bank may add a conversion fee');
    });
  });

  test.describe('for a reader in the UK', () => {
    test.use({ locale: 'en-GB' });

    test('says nothing, because sterling is already their currency', async ({ page }) => {
      await expect(page.locator('body')).not.toContainText('pounds sterling');
      await expect(page.locator('body')).not.toContainText('conversion fee');
    });
  });
});
