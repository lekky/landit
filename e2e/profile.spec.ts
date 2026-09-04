import { AVATARS, SPORTS } from '@landit/core';
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

  // No button to press: the tap is the save. This assertion is the one that
  // fails if a Save button ever comes back and the rest of the file keeps
  // passing because it happened to be clicked.
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);

  await skate.click();
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

  // Three taps in a row, each its own write. The panel numbers them and lets
  // only the newest answer land, so what survives the reload below is the third
  // draft and not whichever reply happened to come back last.
  await page.getByRole('button', { name: 'Ride street properly' }).click();
  await page.getByRole('button', { name: 'Park regular' }).click();
  await page.getByRole('button', { name: 'Regular', exact: true }).click();
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
  await expect(page.getByText('Saved')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Regular', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

/*
 * The other half of having no Save button: a draft that is not yet an answer.
 *
 * "Something else" with nothing written under it fails the same check the
 * server runs, so the panel holds it rather than posting a profile with no
 * goal. What matters to a rider is that the goal they already had is still
 * theirs afterwards — a half-finished thought must not cost them the thing it
 * was going to replace.
 */
test('an unfinished goal is held rather than saved, and the old one survives', async ({ page }) => {
  await onboardedRider(page);

  await expect(page.getByRole('button', { name: 'Land my first trick' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: '+ Something else' }).click();
  await expect(page.getByText('Write a goal, or pick one of the others.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Land my first trick' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // And once it is a real goal, it goes without anything being pressed.
  await page.getByRole('button', { name: '+ Something else' }).click();
  await page.getByLabel('Your goal').fill('Land a bri flip before the summer');
  await expect(page.getByText('Saved')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Your goal')).toHaveValue('Land a bri flip before the summer');
});

/*
 * The last avatar in the first group — the one a phone could not reach.
 *
 * Named from the data rather than typed in, so adding an avatar to Lids moves
 * the assertion to the new last one instead of quietly testing a cell that is
 * no longer at the bottom.
 */
const LAST_LID = AVATARS.filter((avatar) => avatar.group === 'Lids').at(-1)!;

test('the avatar picker has one scroll region on a phone, and the choice sticks', async ({
  page,
}) => {
  // A small phone, where the grid falls to three columns and a twelve-plus
  // group runs past a screen. Bigger screens get more columns and fewer rows,
  // so this is the size that finds the problem.
  await page.setViewportSize({ width: 375, height: 667 });
  await onboardedRider(page);

  await page.getByRole('button', { name: /picture/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  /*
   * The regression this pins (`components/avatarPicker.module.css`): each group
   * capped itself at `46vh` and scrolled inside a modal that was already
   * scrolling, so on a touch device — which draws no scrollbar until a drag —
   * the rows below the cap were not discoverable at all. Six of the fifteen
   * Lids were gone.
   */
  // Read through a locator rather than `page.evaluate`: this project's e2e
  // tsconfig has no DOM lib, so `document` and `getComputedStyle` are not names
  // here (the same note as `shell.spec.ts`). Asking each element whether it will
  // actually move needs nothing but the element Playwright hands over — and it
  // is the rider's question, not the stylesheet's: not "what is `overflow-y`"
  // but "does this thing scroll under a thumb".
  const scrollable = await page.locator('.modal *').evaluateAll((elements) =>
    elements
      .filter((el) => {
        const before = el.scrollTop;
        el.scrollTop = 9999;
        const moved = el.scrollTop > before;
        el.scrollTop = before;
        return moved;
      })
      .map((el) => `${el.tagName}[${el.getAttribute('class') ?? ''}]`),
  );
  expect(scrollable).toEqual([]);

  // And the cell that was out of reach is a cell a rider can actually use.
  // Not `exact`: the cell's accessible name is its image's alt text followed by
  // the caption under it, and both are the avatar's name.
  // The defect that removing the Save button was for: a rider picked a face,
  // pressed Done, saw it in the panel, and had written nothing.
  await page.getByRole('button', { name: LAST_LID.name }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Saved')).toBeVisible();

  await page.reload();
  await expect(page.getByText(LAST_LID.name)).toBeVisible();
});
