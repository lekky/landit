import { SPORTS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { POCKETBASE_URL } from './support/seed-library';
import { finishOnboarding, pickEverySport } from './support/onboarding';
import { seedSchedule } from './support/seed-schedule';

/**
 * The session form (T38), for a rider on the free plan — and its three steps
 * since the app shell rethink (T50, §3.10).
 *
 * What only a rendered page can show, each a decision rather than a detail
 * (LESSONS §3a):
 *
 * - **The three-tap quick log saves**, and the confirmation is the server's —
 *   "Session logged" is rendered from the action's result, never optimistically
 *   (LESSONS §1, "waiting for optimistic copy is waiting for nothing").
 * - **Rookie's clip field is locked**, and says what unlocks it, rather than
 *   taking a link the hook would refuse.
 * - **Next · Next · Save writes the same record the one long form did.** The
 *   steps are presentation over one values object and one server action, and
 *   the way that breaks is silently: a field left off a step is a field that
 *   stops being saved, and nothing about the page would look wrong.
 * - **"What you rode" is taken from the top bar's chip** (D5), so a rider who
 *   rides three sports does not answer the same question twice.
 *
 * The spots are the global setup's (`seed-spots.ts`), so the spot is picked by
 * searching for one the database really holds, not a name this file invents.
 */

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

async function newRider(page: Page, everySport = false): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Session Tester');
  await page.getByLabel('Email').fill(`e2e-session-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
  if (everySport) await pickEverySport(page);
  await finishOnboarding(page);
  await page.waitForURL((url) => !url.pathname.startsWith('/onboarding'));
}

/** The full form's three steps (§3.10). */
const steps = (page: Page) => page.getByRole('tablist', { name: 'Session form steps' });

/**
 * Pick a live spot in the "Where" card, wherever the card is drawn.
 *
 * A no-op once the rider has logged somewhere: the form opens on their most
 * recent spot, so the control names that spot rather than offering to pick one.
 */
async function pickSpot(page: Page, spotName: string): Promise<void> {
  const prompt = page.getByRole('button', { name: /Pick where you rode/ });
  if ((await prompt.count()) === 0) return;
  await prompt.click();
  const sheet = page.getByRole('dialog', { name: 'Where did you ride?' });
  await sheet.getByLabel('Search spots').fill(spotName.slice(0, 12));
  await sheet
    .getByRole('button', { name: new RegExp(spotName.slice(0, 12), 'i') })
    .first()
    .click();
}

async function aLiveSpotName(): Promise<string> {
  const response = await fetch(
    `${POCKETBASE_URL}/api/collections/spots/records?perPage=1&sort=name&filter=${encodeURIComponent("status='live'")}`,
  );
  const body = (await response.json()) as { items: { name: string }[] };
  const name = body.items[0]?.name;
  if (!name) throw new Error('The e2e database has no live spot to log a session at.');
  return name;
}

test('a rookie logs a session from the quick log in three taps', async ({ page }) => {
  const spotName = await aLiveSpotName();
  await newRider(page);

  await page.goto('/progress/sessions/new?quick=1');
  await expect(page.getByText('Rode just now')).toBeVisible();

  await page.getByRole('button', { name: /Pick where you rode/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Where did you ride?' });
  await sheet.getByLabel('Search spots').fill(spotName.slice(0, 12));
  await sheet
    .getByRole('button', { name: new RegExp(spotName.slice(0, 12), 'i') })
    .first()
    .click();

  await page.getByRole('radio', { name: /Good/ }).click();
  await page.getByRole('button', { name: 'Log it' }).click();

  await expect(page.getByText('Session logged')).toBeVisible();
  await expect(page.getByText('Anything else while it is fresh?')).toBeVisible();
});

test('a rookie meets the clip field locked, with what unlocks it', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress/sessions/new');

  // The clip lives on Notes, the third step (§3.10). Reached by its tab rather
  // than by pressing Next twice, because this test is about the lock and not
  // about how a rider gets there.
  await steps(page).getByRole('tab', { name: 'Notes' }).click();

  const clip = page.locator('#session-clip');
  await expect(
    clip.getByText('logs sessions in words. Links come with', { exact: false }),
  ).toBeVisible();
  await expect(clip.getByRole('textbox')).toHaveCount(0);
  await expect(clip.getByRole('link', { name: 'See the plans' })).toBeVisible();

  /*
   * "Change the default" goes to the sessions-visibility screen (issue #558).
   *
   * It said "your account" and meant one of the seven screens `/account` became
   * a list of, so a rider told what their default is — on the step where they
   * are choosing who sees this one — was sent to a list of eight rows.
   */
  await page.getByRole('link', { name: 'Change the default' }).click();
  await page.waitForURL('**/account/sessions');
});

test('Next · Next · Save writes the same session the one long form did', async ({ page }) => {
  /*
   * §3.10 turned twelve fields into three steps, at every width. The promise
   * underneath is that nothing about what is *saved* moved: one values object,
   * one server action, the same month cap and the same one-way stage
   * promotion. A field dropped off a step is a field that stops being saved
   * and a page that still looks right, so this walks the steps and then reads
   * the record back off the detail page.
   */
  const spotName = await aLiveSpotName();
  await newRider(page);
  await page.goto('/progress/sessions/new');

  const row = steps(page);
  await expect(row.getByRole('tab', { name: 'When & where' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // Step one: where, and the time the form opened with.
  await pickSpot(page, spotName);
  await page.getByRole('button', { name: 'Next', exact: true }).first().click();

  // Step two: the sport is a statement, and the aim is a sentence.
  await expect(row.getByRole('tab', { name: 'What' })).toHaveAttribute('aria-selected', 'true');
  await page.getByLabel('Aim of the session').fill('Pump the whole run');
  await page.getByRole('button', { name: 'Next', exact: true }).first().click();

  // Step three: how it felt, then Save.
  await expect(row.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('radio', { name: /Good/ }).click();
  await page.getByRole('button', { name: 'Save session' }).click();

  await expect(page.getByText('Session logged')).toBeVisible();

  // And it is in the diary, carrying what step one and step two collected.
  await page.goto('/progress/sessions');
  const card = page.getByRole('article', { name: new RegExp(spotName.slice(0, 12), 'i') }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText('Pump the whole run')).toBeVisible();
});

test('Save on an unfinished step lands on the step that can fix it', async ({ page }) => {
  /*
   * The stepped form's one new way to be wrong: a refusal about a control the
   * rider cannot see. `formProblems` still runs over the whole values object,
   * and `stepForField` is what puts the message beside the field.
   */
  await newRider(page);
  await page.goto('/progress/sessions/new');

  const row = steps(page);
  /*
    Nothing picked: Next cannot leave step one, and says why. Matched on the
    opening words rather than the whole sentence, because since 2026-09-17 it
    ends "…, or type where it was" — the map is no longer the only answer
    (`sessions.spot_name`, owner in chat) and the refusal offers both routes.
  */
  await page.getByRole('button', { name: 'Next', exact: true }).first().click();
  await expect(row.getByRole('tab', { name: 'When & where' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('alert').filter({ hasText: /Pick where you rode/ })).toBeVisible();

  // And the same refusal reaches a rider who skipped ahead and pressed Save:
  // the message lands on the step that answers it, not on the one they are on.
  await row.getByRole('tab', { name: 'Notes' }).click();
  await page.getByRole('button', { name: 'Save session' }).click();
  await expect(row.getByRole('tab', { name: 'When & where' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('alert').filter({ hasText: /Pick where you rode/ })).toBeVisible();
});

test('“What you rode” is the chip’s sport, stated rather than asked', async ({ page }) => {
  /*
   * D5: the sport is chosen once, in the top bar. Before T50 the form asked
   * again with a three-button row, pre-set to the rider's *first* sport — which
   * the server picks, because the chip is a per-device preference it cannot
   * see. A rider on BMX met a scooter form, and `TricksField` filters by
   * `values.sport`, so their BMX tricks were not even offered.
   */
  await newRider(page, true);
  await page.setViewportSize({ width: 1280, height: 800 });

  // Switch the chip to the second sport, in the one place the choice is made.
  await page.goto('/home');
  await page.getByRole('button', { name: /^Riding: .+\. Switch sport\.$/ }).click();
  const menu = page.getByRole('group', { name: 'Switch sport' });
  await expect(menu).toBeVisible();
  await menu.getByRole('button').nth(1).click();
  await expect(menu).toBeHidden();
  const riding = await page
    .getByRole('button', { name: /^Riding: .+\. Switch sport\.$/ })
    .getAttribute('aria-label');
  const chipSport = /^Riding: (.+)\. Switch sport\.$/.exec(riding ?? '')?.[1];
  expect(chipSport).toBeTruthy();

  await page.goto('/progress/sessions/new');
  await steps(page).getByRole('tab', { name: 'What' }).click();

  // A tag, not a row of buttons — and it names what the chip names.
  const label = Object.values(SPORTS).find((s) => s.short === chipSport)?.label ?? '';
  await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'What you rode' })).toHaveCount(0);

  // Change reveals the picker that was always there.
  await page.getByRole('button', { name: 'Change' }).click();
  await expect(page.getByRole('radiogroup', { name: 'What you rode' })).toBeVisible();
});

test('the quick log says which sport it is about to log', async ({ page }) => {
  /*
   * §3.10: "Quick log — unchanged, shows the sport `Tag`". It asks three
   * questions and the sport is not one of them, so until T50 the one thing a
   * rider could not see before pressing "Log it" was which library the ride
   * would land in.
   */
  await newRider(page);
  await page.goto('/progress/sessions/new?quick=1');
  await expect(page.getByText('Rode just now')).toBeVisible();
  await expect(page.getByText(SPORTS.scooter.short, { exact: true }).first()).toBeVisible();
});

test('each "while it is fresh" prompt opens the form on the field it names', async ({ page }) => {
  /*
   * The blocker the T50 review found (B1). On one long form every anchor was
   * always in the document and the prompt only had to scroll; with three steps
   * the section has to be on screen first. Built wrong, a rider who pressed
   * "A clip" got When, How long and Where — no clip field anywhere, no message,
   * and a primary button reading Next.
   *
   * Nothing exercised this path on either side of the change, which is why it
   * got through. One rider, three quick logs (Rookie allows four a month), a
   * different prompt each time.
   */
  const spotName = await aLiveSpotName();
  await newRider(page);

  const cases = [
    { prompt: 'Tricks you worked on', step: 'What', anchor: '#session-tricks' },
    { prompt: 'A clip', step: 'Notes', anchor: '#session-clip' },
    // "Notes and the aim" points at the **aim** card, which is on What — the
    // same place `main` scrolled to, because `#session-notes` is its id.
    { prompt: 'Notes and the aim', step: 'What', anchor: '#session-notes' },
  ] as const;

  for (const { prompt, step, anchor } of cases) {
    await page.goto('/progress/sessions/new?quick=1');
    await pickSpot(page, spotName);
    await page.getByRole('radio', { name: /Good/ }).click();
    await page.getByRole('button', { name: 'Log it' }).click();
    await expect(page.getByText('Anything else while it is fresh?')).toBeVisible();

    await page.getByRole('button', { name: prompt }).click();
    await expect(
      steps(page).getByRole('tab', { name: step, exact: true }),
      `"${prompt}" did not open the ${step} step`,
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(anchor), `"${prompt}" did not show ${anchor}`).toBeVisible();
  }
});

test('an edit saves from whichever step it is on', async ({ page }) => {
  /*
   * Review S1. Stepping answers "twelve fields in one scroll", which is a
   * problem a blank form has; an edit arrives filled and valid and the rider is
   * there to change one word. Built without the exception, every primary button
   * on the screen read NEXT until the third step, where `main` offered SAVE
   * immediately. There was no e2e over the edit form on either side, which is
   * why nothing caught it.
   */
  const spotName = await aLiveSpotName();
  await newRider(page);

  await page.goto('/progress/sessions/new?quick=1');
  await pickSpot(page, spotName);
  await page.getByRole('radio', { name: /Good/ }).click();
  await page.getByRole('button', { name: 'Log it' }).click();
  await expect(page.getByText('Session logged')).toBeVisible();

  await page.goto('/progress/sessions');
  await page.getByRole('link', { name: 'Edit', exact: true }).first().click();
  await page.waitForURL('**/edit');

  // Step one of an edit, and the primary already saves.
  const row = steps(page);
  await expect(row.getByRole('tab', { name: 'When & where' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);

  // Change a field on the third step, walk back to the first, and save there.
  await row.getByRole('tab', { name: 'Notes', exact: true }).click();
  /*
   * By role, not by label. The panel is `aria-labelledby` its tab — ARIA's own
   * pattern — and the tab is called Notes, so the panel and the textarea inside
   * it share an accessible name whichever way the panel is labelled. What the
   * `aria-labelledby` fixed is that the panel now *references* the tab instead
   * of copying its words, so the two cannot drift apart.
   */
  await page
    .getByRole('textbox', { name: 'Notes', exact: true })
    .fill('Kept the speed through the bowl.');
  await row.getByRole('tab', { name: 'When & where' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();

  await page.waitForURL((url) => !url.pathname.endsWith('/edit'));
  await expect(page.getByText('Kept the speed through the bowl.')).toBeVisible();
});

test('a rider names the event they were at, days after it happened', async ({ page }) => {
  /*
   * The gap this closes (T53, owner in chat 2026-09-18). An event used to reach
   * a session only by being offered: from the event's own page on its own day,
   * or from the purple band, which needs an event dated *today* whose pin is
   * within 1 km of a spot on the map. Neither can serve the ordinary case of
   * writing a jam up afterwards, and only a rendered page can show that the way
   * in works — the pure part of it (`eventsOnDay`, `sessionFormDay`) is unit
   * tested, and would pass just as happily behind a press nobody can reach.
   *
   * `seedSchedule` already seeds an event twenty days back ("E2E Last Month
   * Session"), which is inside the thirty-day window and nowhere near a spot —
   * exactly the session that could not be logged before.
   */
  await seedSchedule();
  const spotName = await aLiveSpotName();
  await newRider(page);
  await page.goto('/progress/sessions/new');

  await pickSpot(page, spotName);

  // Twenty days ago, which is when the seeded event was on.
  const wasOn = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
  await page.getByRole('radio', { name: 'Pick a time' }).click();
  await page.getByLabel('Day').fill(wasOn);

  await page.getByRole('button', { name: 'Were you at an event?' }).click();
  const sheet = page.getByRole('dialog', { name: 'Were you at an event?' });
  await sheet.getByRole('button', { name: /E2E Last Month Session/ }).click();

  // The band now speaks for the rider's answer rather than an offer.
  await expect(page.getByText('attached to this session')).toBeVisible();
  await expect(page.getByText('E2E Last Month Session')).toBeVisible();

  // And it is on the session the server saved, not just on the form: on to the
  // last step, save, and read the event pill back off the diary.
  await page.getByRole('button', { name: 'Next', exact: true }).first().click();
  await page.getByRole('button', { name: 'Next', exact: true }).first().click();
  await page.getByRole('button', { name: 'Save session' }).click();
  await expect(page.getByText('Session logged')).toBeVisible();

  await page.goto('/progress/sessions');
  await expect(page.getByRole('link', { name: 'E2E Last Month Session' }).first()).toBeVisible();
});
