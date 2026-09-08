import type { Page } from '@playwright/test';

/**
 * Walk a freshly signed-up rider through onboarding to Home, keeping every
 * default: the sport step as the caller left it, "Just started", "Land my first
 * trick", and step 5 (where they found us) skipped.
 *
 * Twelve specs need a rider on the far side of onboarding and none of them is
 * *about* it. Each used to click the steps by hand, so when a fifth step was
 * added on 2026-09-06 every one of them broke at once — the third `Next` no
 * longer reached the last screen, so "Let's go" was not there (issue #324).
 * Now a change to the steps is a change here. `auth.spec.ts` keeps one
 * hand-walked copy, because it is the place that asserts on what the steps
 * actually say and answers step 5 rather than skipping it.
 *
 * Call it once the page is on `/onboarding` and any sport choice has been made;
 * it ends on the click of "Let's go" and does not wait for Home, so the caller
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
  await page.getByRole('button', { name: "Let's go" }).click();
}
