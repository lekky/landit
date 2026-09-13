import { PLAN, sessionAllowance, sessionsPerMonthLabel } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding } from './support/onboarding';

/**
 * Sessions: the plan comparison and the "who sees new sessions" setting (T40).
 *
 * The comparison half runs signed out, like `plans.spec.ts`, and pins the two
 * things a copy edit could undo without failing a build: the allowance on the
 * page is the one the plan grants (rendered from the record, never typed), and
 * a stage move is "Always" on every plan, because a stage is never for sale.
 *
 * The settings half pins that the choice goes round the server and back.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

async function onboardedRider(page: Page): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Nadia Ellis');
  await page.getByLabel('Email').fill(`e2e-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  await finishOnboarding(page);
  await page.waitForURL('**/home');
}

test.describe('what each plan logs', () => {
  test('a desktop table, with the allowance the plan actually grants', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/plans');

    const table = page.getByRole('table');
    await expect(
      page.getByRole('heading', { name: 'What each plan logs', level: 2 }),
    ).toBeVisible();
    await expect(table).toBeVisible();

    const sessions = table.locator('tr[data-row="sessions"]');
    await expect(sessions).toContainText(sessionsPerMonthLabel(sessionAllowance(PLAN.rookie)));

    const always = table.locator('tr[data-row="stage_moves"] td');
    await expect(always).toHaveCount(3);
    await expect(always).toHaveText(['Always', 'Always', 'Always']);

    await expect(page.locator('body')).toContainText('Nothing here sells a stage or a sticker');
  });

  test('three stacked cards on a phone, and no table', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/plans');

    await expect(page.getByRole('table')).toBeHidden();
    for (const slug of ['rookie', 'shredder', 'legend']) {
      await expect(page.locator(`[data-sessions-plan="${slug}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-sessions-plan="rookie"]')).toContainText(
      sessionsPerMonthLabel(sessionAllowance(PLAN.rookie)),
    );
  });
});

test('who sees new sessions starts on Only me, and a change survives a reload', async ({
  page,
}) => {
  await onboardedRider(page);
  await page.goto('/account');

  const group = page.getByRole('radiogroup', { name: 'Who sees new sessions' });
  await expect(group.getByRole('radio', { name: /^Only me/ })).toBeChecked();

  const form = page.getByRole('form', { name: 'Who sees new sessions' });
  await group.getByRole('radio', { name: /^Crew/ }).check();
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form.getByText('Saved')).toBeVisible();

  await page.reload();
  await expect(
    page
      .getByRole('radiogroup', { name: 'Who sees new sessions' })
      .getByRole('radio', { name: /^Crew/ }),
  ).toBeChecked();
});
