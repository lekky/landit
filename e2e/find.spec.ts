import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding, pickEverySport } from './support/onboarding';
import { seedLibrary } from './support/seed-library';
import { seedSchedule } from './support/seed-schedule';
import { seedSpots } from './support/seed-spots';

/**
 * **Find** — the hub, its tab row and the sport scope select (rethink §3.7, T48).
 *
 * The bottom bar's fourth cell used to redirect to `/spots`, which answered one
 * of the three questions a rider presses Find with. What has to hold now is
 * that all three are on one screen, that the tab row is the same control on all
 * three routes, and that the scope select opens where O1 says and remembers
 * what a rider chose.
 *
 * **What is asserted here and not elsewhere.** `spots.spec.ts` and
 * `events.spec.ts` own the two lists and their own copies of the scope select;
 * this file owns the hub, the row that ties the three screens together, and the
 * signed-out shape of both. The gate on `/events/mine` is checked in both
 * places on purpose: it is the one route in the group that is somebody's own
 * record, and a spec that only checked it beside the control that used to link
 * to it would stop checking it the day that control moved — which is exactly
 * what happened here.
 */

/*
 * The one browser global this file reads. The e2e tsconfig has no DOM lib (see
 * `shell.spec.ts`), and the sideways-scroll check below has to measure the
 * document rather than the viewport it was given. Declared narrowly, as a type
 * only — `declare` erases.
 */
declare const document: { documentElement: { scrollWidth: number; clientWidth: number } };

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

test.describe.configure({ mode: 'default' });

test.beforeAll(async () => {
  await seedLibrary();
  await seedSchedule();
  await seedSpots();
});

function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

async function newRider(page: Page): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Find Tester');
  await page.getByLabel('Email').fill(`e2e-find-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  await pickEverySport(page);
  await finishOnboarding(page);
  await page.waitForURL('**/home');
}

/** The Find group's tab row, wherever it is drawn. */
const tabs = (page: Page) =>
  page.getByRole('navigation', { name: 'Find: for you, spots or events' });

test('the hub answers the three questions a rider presses Find with', async ({ page }) => {
  await newRider(page);
  await page.goto('/find');

  // The header, which the hub keeps at every width because it is the group's
  // landing screen rather than a list with a lit tab above it.
  await expect(page.getByRole('heading', { level: 1, name: 'Where to ride' })).toBeVisible();

  // Three sections, in the order §3.7 lists them for a signed-in rider.
  await expect(page.getByRole('heading', { name: 'You’re going' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Near you' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible();

  // Each one hands over to the screen that holds the rest of it, which is what
  // makes the hub a summary rather than a fourth list.
  await expect(page.getByRole('link', { name: /^Mine/ })).toHaveAttribute('href', '/events/mine');
  await expect(page.getByRole('link', { name: /^All spots/ })).toHaveAttribute('href', '/spots');
  await expect(page.getByRole('link', { name: /^All events/ })).toHaveAttribute('href', '/events');

  // Coming up is the calendar: the seeded jam is on it, and the finished one
  // never is — the hub reads `upcomingEvents` like everything else does.
  await expect(page.getByRole('link', { name: 'E2E Northern Jam' })).toBeVisible();
  await expect(page.getByText('E2E Last Month Session')).toHaveCount(0);
});

test('a visitor gets the tab row and the two sections that are not about them', async ({
  page,
}) => {
  // Deliberately no sign-up. `/find` is public on the same terms as `/spots`
  // and `/events`: the calendar is public data and a spot is a public place.
  await page.goto('/find');

  await expect(page.getByRole('heading', { level: 1, name: 'Where to ride' })).toBeVisible();
  await expect(tabs(page)).toBeVisible();

  // Coming up and Near you, and **not** "You're going" — a visitor has no
  // attendance, so the section could only ever be an advert for a locked door.
  await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Near you' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You’re going' })).toHaveCount(0);

  // The calendar is readable without an account, which is the whole reason the
  // hub can be public at all.
  await expect(page.getByRole('link', { name: 'E2E Northern Jam' })).toBeVisible();

  // And the one gated route in the group is still gated, from here as from
  // anywhere: `/events` and `/events/past` are public, this one is one rider's
  // own attendance.
  await page.goto('/events/mine');
  await page.waitForURL('**/signin?next=*');
  expect(new URL(page.url()).searchParams.get('next')).toBe('/events/mine');
});

test('the tab row is the same three links on all three routes', async ({ page }) => {
  await newRider(page);

  for (const [path, current] of [
    ['/find', 'For you'],
    ['/spots', 'Spots'],
    ['/events', 'Events'],
  ] as const) {
    await page.goto(path);
    const row = tabs(page);
    await expect(row).toBeVisible();

    // Three links, in one order, pointing at the three routes. A row that is
    // assembled per screen is a row that eventually disagrees with itself.
    await expect(row.getByRole('link')).toHaveText(['For you', 'Spots', 'Events']);
    await expect(row.getByRole('link', { name: 'For you' })).toHaveAttribute('href', '/find');
    await expect(row.getByRole('link', { name: 'Spots' })).toHaveAttribute('href', '/spots');
    await expect(row.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/events');

    /*
     * `aria-current="page"` is what says which tab you are on, and exactly one
     * carries it. Links rather than `role="tab"` deliberately (§3.3): a screen
     * reader told something is a tab expects the panel under it to change, not
     * the document.
     */
    await expect(row.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(row.getByRole('link', { name: current })).toHaveAttribute('aria-current', 'page');
    await expect(row.getByRole('tab')).toHaveCount(0);
  }

  // The archive and a rider's own events are the calendar too, so Events stays
  // lit on both rather than the row going dark on a screen inside the group.
  for (const path of ['/events/past', '/events/mine']) {
    await page.goto(path);
    await expect(tabs(page).getByRole('link', { name: 'Events' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
});

test('the tab row walks a rider between the three screens', async ({ page }) => {
  await newRider(page);
  await page.goto('/find');

  await tabs(page).getByRole('link', { name: 'Spots' }).click();
  await page.waitForURL('**/spots');
  await expect(page.getByLabel('Show spots for')).toBeVisible();

  await tabs(page).getByRole('link', { name: 'Events' }).click();
  await page.waitForURL('**/events');
  await expect(page.getByLabel('Show events for')).toBeVisible();

  await tabs(page).getByRole('link', { name: 'For you' }).click();
  await page.waitForURL('**/find');
  await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible();
});

test('the scope select opens where O1 says, per screen, and remembers it', async ({ page }) => {
  /*
   * O1, 2026-09-16 (Rachid, in chat): "the default follows the quality of the
   * data. Spots opens on Every spot… Events opens on your sport". Two screens,
   * two defaults, one control — which is exactly the kind of pair that drifts
   * into being the same default by accident, so it is pinned as a pair.
   */
  await newRider(page);

  await page.goto('/spots');
  const spots = page.getByLabel('Show spots for');
  await expect(spots).toHaveValue('all');
  // The screen's own word for "all", not the calendar's.
  await expect(spots.locator('option[value="all"]')).toHaveText('Every spot');

  await page.goto('/events');
  const events = page.getByLabel('Show events for');
  await expect(events).toHaveValue('chip');
  await expect(events.locator('option[value="all"]')).toHaveText('All sports');

  /*
   * The first option names the sport rather than saying "Your sport" and
   * leaving a rider to look at the top bar for the answer.
   */
  await expect(events.locator('option[value="chip"]')).toHaveText(/^Your sport \(.+\)$/);

  // Per screen and per device: changing the calendar's scope leaves the spots
  // list alone, and both survive a reload.
  await events.selectOption('all');
  await expect(events).toHaveValue('all');

  await page.goto('/spots');
  await expect(page.getByLabel('Show spots for')).toHaveValue('all');
  await page.getByLabel('Show spots for').selectOption('bmx');
  await expect(page.getByLabel('Show spots for')).toHaveValue('bmx');

  await page.reload();
  await expect(page.getByLabel('Show spots for')).toHaveValue('bmx');
  await page.goto('/events');
  await expect(page.getByLabel('Show events for')).toHaveValue('all');
});

test('the scope select follows the sport chip rather than copying it', async ({ page }) => {
  /*
   * D5: the sport is chosen once, in the top bar. The first option is stored as
   * the word `chip` and not as a sport id, so a rider who switches sport
   * anywhere in the product switches this list with it — which is the whole
   * reason the option exists rather than the chip's sport simply being
   * preselected by name.
   */
  await newRider(page);
  await page.goto('/events');

  const events = page.getByLabel('Show events for');
  await expect(events).toHaveValue('chip');
  const first = await events.locator('option[value="chip"]').innerText();

  // Switch sport in the top bar, which is the one place the choice is made.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /^Riding: .+\. Switch sport\.$/ }).click();
  const menu = page.getByRole('group', { name: 'Switch sport' });
  await expect(menu).toBeVisible();
  await menu.getByRole('button').nth(1).click();
  await expect(menu).toBeHidden();

  // The scope is still "your sport" — and it now names a different one.
  await expect(events).toHaveValue('chip');
  await expect(events.locator('option[value="chip"]')).not.toHaveText(first);
});

test('none of the three screens scrolls sideways, down to a 320px phone', async ({ page }) => {
  /*
   * Issue #550: `.tabrow .sporttab` is `flex: 1` with `white-space: nowrap`, so
   * a label that does not fit neither wraps nor clips — the box grows past its
   * share, the row grows past the container, and the whole document scrolls
   * sideways. T46 measured Progress at 30px over at 320px with Record · Over
   * time · Skill tree and tightened that row locally; the issue names Find as
   * the next three-tab row to meet it.
   *
   * Measured here rather than assumed: For you · Spots · Events is short enough
   * to fit at 320 as it stands, so this row needs no tightening — and this is
   * what says so, and what fails if the labels are ever made longer or the
   * scope select's `<select>` is given a width it cannot honour. The general
   * `.tabrow` fix stays open on #550, because `.tabrow` is T45's.
   */
  await newRider(page);

  for (const path of ['/find', '/spots', '/events']) {
    for (const width of [430, 390, 375, 360, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(over, `${path} is ${over}px wider than a ${width}px screen`).toBeLessThanOrEqual(0);
    }
  }
});
