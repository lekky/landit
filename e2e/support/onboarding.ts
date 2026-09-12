import { SPORTS, SPORT_IDS } from '@landit/core';
import type { Page } from '@playwright/test';

/**
 * Walk a freshly signed-up rider through onboarding to Home, keeping every
 * default: the sport step as the caller left it, "Just started", "Land my first
 * trick", and step 5 (where they found us) skipped.
 *
 * Twelve specs need a rider on the far side of onboarding and none of them is
 * *about* it. Each used to click the steps by hand, so when a fifth step was
 * added on 2026-09-06 every one of them broke at once — the third `Next` no
 * longer reached the last screen, so "Let’s go" was not there (issue #324).
 * Now a change to the steps is a change here. `auth.spec.ts` keeps one
 * hand-walked copy, because it is the place that asserts on what the steps
 * actually say and answers step 5 rather than skipping it.
 *
 * Call it once the page is on `/onboarding` and any sport choice has been made;
 * it ends on the click of "Let’s go" and does not wait for Home, so the caller
 * keeps deciding what "arrived" means.
 */
export async function finishOnboarding(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Just started/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Land my first trick' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  // Step 5 asks where the rider found us and is skippable, which is what these
  // walkthroughs exercise by clicking past it.
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s go' }).click();
}

/**
 * Turn on every sport on onboarding step 1, whatever it arrived with.
 *
 * Two specs need a rider who rides all of them, and both used to click every
 * card in `SPORT_IDS` blind. That worked only while an already-picked card was
 * a no-op: step 1 opens with the first sport on, and the last sport on cannot
 * be turned off, so its card is now `disabled` rather than silently ignoring
 * the tap — and a blind click waited on it until the test timed out.
 *
 * So this asks each card whether it is on before pressing it. `aria-pressed`
 * is the button's own answer, which keeps the walk honest if the screen ever
 * arrives with a different sport picked, or with more than one.
 */
export async function pickEverySport(page: Page): Promise<void> {
  for (const id of SPORT_IDS) {
    const card = page.getByRole('button', { name: new RegExp(SPORTS[id].label, 'i') });
    if ((await card.getAttribute('aria-pressed')) !== 'true') await card.click();
  }
}
