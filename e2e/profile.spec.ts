import { SPORTS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

/**
 * The profile editor on `/account` (T23).
 *
 * The assertion this file exists for is the first one: **a rider can change
 * what they ride after signing up, and it survives a reload**. Onboarding asked
 * once and nothing asked again (issue #96), so the thing worth pinning is not
 * that the panel renders — it is that a second sport is still there on the next
 * request, from the database rather than from React state that has not been
 * dropped yet.
 *
 * The rest of the file guards the floor of one sport, and the three answers
 * that are changed rather than added to — goal, level and stance, including
 * clearing a stance by tapping it again.
 *
 * Not covered here: that turning a sport off leaves `trick_progress` alone.
 * `saveProfileAction` never touches that collection, so there is nothing to
 * observe from the browser without first tracking a trick in a second sport —
 * the assertion belongs with the library specs rather than this one.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

/** A date of birth `years` before today, as the date input wants it. */
function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * An onboarded rider on the scooter library, at the account screen.
 *
 * Deliberately the long way round rather than a seeded fixture: the profile
 * these tests edit is the one onboarding actually wrote, so a change to what
 * onboarding stores shows up here rather than being papered over by a fixture
 * that agrees with the test.
 */
async function onboardedRider(page: Page): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Nadia Ellis');
  await page.getByLabel('Email').fill(`e2e-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Just started/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Land my first trick' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "Let's go" }).click();

  await page.waitForURL('**/home');
  await page.goto('/account');
}

test('a rider can take up a second sport after signing up, and it sticks', async ({ page }) => {
  await onboardedRider(page);

  const skate = page.getByRole('button', { name: new RegExp(SPORTS.skate.label, 'i') });
  await expect(skate).toHaveAttribute('aria-pressed', 'false');

  await skate.click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  // The point of the test: gone round the server and back, not still in state.
  await page.reload();
  await expect(
    page.getByRole('button', { name: new RegExp(SPORTS.skate.label, 'i') }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('the last sport a rider has cannot be turned off', async ({ page }) => {
  await onboardedRider(page);

  // Onboarding starts a rider on one sport, so this is that one.
  await expect(
    page.getByRole('button', { name: new RegExp(SPORTS.scooter.label, 'i') }),
  ).toBeDisabled();

  // With a second sport on, either may go — the floor is one, not this one.
  await page.getByRole('button', { name: new RegExp(SPORTS.skate.label, 'i') }).click();
  await expect(
    page.getByRole('button', { name: new RegExp(SPORTS.scooter.label, 'i') }),
  ).toBeEnabled();
});

test('the goal, the level and the stance can be changed, and the stance cleared', async ({
  page,
}) => {
  await onboardedRider(page);

  await page.getByRole('button', { name: 'Ride street properly' }).click();
  await page.getByRole('button', { name: 'Park regular' }).click();
  await page.getByRole('button', { name: 'Regular', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Ride street properly' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Park regular' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Regular', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Tapping the chosen stance again clears it — the prototype's behaviour, and
  // the reason "not saying" needs no option of its own.
  await page.getByRole('button', { name: 'Regular', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Regular', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
