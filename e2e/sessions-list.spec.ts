import { SPORTS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { finishOnboarding, pickEverySport } from './support/onboarding';
import { POCKETBASE_URL } from './support/seed-library';

/**
 * Progress › Sessions (T37), and the header the app shell rethink gave it (T50).
 *
 * What only the rendered page can show, and what a later change could quietly
 * undo:
 *
 * - **The screen is called Sessions.** It said *Progress* between T46 and T50,
 *   under a Home back link and above the old Sessions / Where-you're-at row —
 *   so the blue Sessions card on Home landed a rider on a page named after the
 *   green one. A heading is the sort of thing a later refactor restores by
 *   accident (rethink §3.10).
 * - **A rider with no sessions gets a way to log one**, not an empty column.
 * - **The Legend insights card is a teaser, with no control** — session
 *   insights are Legend's and opt-in (plan §6.4 standard 12), so the list
 *   offers nothing to switch on.
 * - **The sport is the scope select's and "At an event" is its own pill**, so
 *   the two can hold at once — which the single chip row could not express.
 *
 * The one seeded session is logged through the UI rather than written into the
 * database: the diary is read with the rider's own client under the collection
 * rules, so a row inserted round the back would be proving a page against data
 * the product cannot make.
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
  await page.getByLabel('Your name').fill('Sessions Tester');
  await page.getByLabel('Email').fill(`e2e-sessions-${unique()}@landit.invalid`);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  if (everySport) await pickEverySport(page);
  else
    await expect(
      page.getByRole('button', { name: new RegExp(SPORTS.scooter.label, 'i') }),
    ).toHaveAttribute('aria-pressed', 'true');
  await finishOnboarding(page);
  await page.waitForURL('**/home');
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

/**
 * One session in the diary, logged the way a rider would log it.
 *
 * The spot is only picked the first time: after that the quick log opens on the
 * rider's most recent spot, so the control names that spot rather than offering
 * to pick one.
 */
async function logAQuickSession(page: Page): Promise<void> {
  const spotName = await aLiveSpotName();
  await page.goto('/progress/sessions/new?quick=1');
  const prompt = page.getByRole('button', { name: /Pick where you rode/ });
  if (await prompt.count()) {
    await prompt.click();
    const sheet = page.getByRole('dialog', { name: 'Where did you ride?' });
    await sheet.getByLabel('Search spots').fill(spotName.slice(0, 12));
    await sheet
      .getByRole('button', { name: new RegExp(spotName.slice(0, 12), 'i') })
      .first()
      .click();
  }
  await page.getByRole('radio', { name: /Good/ }).click();
  await page.getByRole('button', { name: 'Log it' }).click();
  await expect(page.getByText('Session logged')).toBeVisible();
}

test('sessions and progress are both under Home, and both open by address', async ({ page }) => {
  /*
   * This checked the section drawer's Progress / Sessions tabs, which went with
   * the drawer in the app shell rethink (T45), and then the in-page row that
   * outlived it, which went in T50. What is worth holding is the half that
   * never depended on either control: both addresses answer, and the bar lights
   * Home on each of them.
   *
   * `nav.test.ts` is what holds the promise that Home reaches them.
   */
  await newRider(page);

  const bar = page.getByRole('navigation', { name: 'Main', exact: true });

  await page.goto('/progress');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Where you’re at');
  await expect(bar.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.goto('/progress/sessions');
  // Sessions, not Progress (§3.10). The two screens are two Home cards, and a
  // rider who pressed one must not land on a page named after the other.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sessions');
  await expect(bar.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // And the row that used to say "Sessions | Where you're at" is gone with
  // every other in-page tab row the rethink retired (D5, §3.10).
  await expect(page.getByRole('navigation', { name: 'Progress' })).toHaveCount(0);

  /*
   * And both say what they are under (§2.3, T46). The lit cell is the bar's
   * half of the promise; the back link is the page's, and it is the half a
   * rider can press. A real link to `/home`, so a deep link still has somewhere
   * to go.
   */
  for (const path of ['/progress', '/progress/sessions']) {
    await page.goto(path);
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Home' }).first(),
      `${path} has no Home back link`,
    ).toHaveAttribute('href', '/home');
  }
});

test('a rider with no sessions is offered a way to log one', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress/sessions');

  await expect(page.getByRole('heading', { name: 'Nothing logged yet' })).toBeVisible();
  const empty = page.getByRole('region', { name: 'Nothing logged yet' });
  await expect(empty.getByRole('link', { name: /log a session/i })).toHaveAttribute(
    'href',
    '/progress/sessions/new',
  );
});

test('the session insights card is a teaser with nothing to switch on', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress/sessions');

  const aside = page.getByRole('complementary', { name: 'Your month' });
  await expect(aside.getByRole('heading', { name: 'Session insights' })).toBeVisible();
  await expect(aside.getByText(/Legend only, and only if you turn it on/)).toBeVisible();
  await expect(aside.getByRole('button')).toHaveCount(0);
});

test('a free rider sees the month allowance and a way to the plans', async ({ page }) => {
  await newRider(page);
  await page.goto('/progress/sessions');

  const aside = page.getByRole('complementary', { name: 'Your month' });
  await expect(aside.getByText('Four left this month')).toBeVisible();
  await expect(aside.getByRole('link', { name: /see the plans/i })).toHaveAttribute(
    'href',
    '/plans',
  );
});

test('the diary opens on the rider’s own sport, and remembers a wider scope', async ({ page }) => {
  /*
   * O1, 2026-09-16 (Rachid, in chat): "Sessions and the glossary open on your
   * sport". The control is the same `SportScopeSelect` the two Find lists
   * carry, on its own `localStorage` key — so widening the diary must not widen
   * the spots list, and neither must widen this one.
   */
  await newRider(page, true);
  await logAQuickSession(page);

  await page.goto('/progress/sessions');
  const scope = page.getByLabel('Show sessions for');
  await expect(scope).toHaveValue('chip');
  await expect(scope.locator('option[value="chip"]')).toHaveText(/^Your sport \(.+\)$/);
  await expect(scope.locator('option[value="all"]')).toHaveText('All sports');

  await scope.selectOption('all');
  await page.reload();
  await expect(page.getByLabel('Show sessions for')).toHaveValue('all');

  // Per screen: the diary's answer is not the calendar's.
  await page.goto('/events');
  await expect(page.getByLabel('Show events for')).toHaveValue('chip');
});

test('the scope and "At an event" are two controls, not four answers to one', async ({ page }) => {
  /*
   * Before T50 the row was All · Scooter · BMX · At an event — one `aria-pressed`
   * group, so "BMX" and "At an event" were alternatives and a rider could not
   * ask for their BMX jam sessions at all. The pill is now independent of the
   * sport, which is the behaviour worth pinning: both held at once.
   */
  await newRider(page, true);
  await logAQuickSession(page);
  await page.goto('/progress/sessions');

  const pill = page.getByRole('button', { name: 'At an event' });
  await expect(pill).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('Show sessions for')).toHaveValue('chip');

  await pill.click();
  await expect(pill).toHaveAttribute('aria-pressed', 'true');
  // The scope did not move with it, and the session logged away from an event
  // has dropped out of the list.
  await expect(page.getByLabel('Show sessions for')).toHaveValue('chip');
  await expect(page.getByText('Nothing logged under that filter yet.')).toBeVisible();

  await pill.click();
  await expect(page.getByRole('article').first()).toBeVisible();
});

test('a phone gets the month’s three numbers, which only the sidebar carried', async ({ page }) => {
  /*
   * §3.10: "on the phone three `StatBlock`s (sessions, time, moved up) then the
   * feed". `.sidebar` is `display: none` below 700px, so before T50 a phone saw
   * none of the month card's numbers — and the numbers are the reason to open
   * the diary at all.
   */
  await newRider(page);
  await logAQuickSession(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/progress/sessions');

  const month = page.getByRole('region', { name: 'This month' });
  await expect(month).toBeVisible();
  // One session, the time on the board, and what moved up: three blocks, and
  // the number and its label are two elements, as the design draws them.
  await expect(month.getByText('session', { exact: true })).toBeVisible();
  await expect(month.getByText('on the board', { exact: true })).toBeVisible();
  await expect(month.getByText('moved up', { exact: true })).toBeVisible();
  // The desktop is not told its month twice: the blocks are the phone's and the
  // ink sidebar card is the desktop's.
  await expect(page.getByRole('complementary', { name: 'Your month' })).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('region', { name: 'This month' })).toBeHidden();
  await expect(page.getByRole('complementary', { name: 'Your month' })).toBeVisible();
});

test('changing the scope puts the rider back on page one', async ({ page }) => {
  /*
   * Review S2. The chip row this replaced reset both pagers on every press; the
   * select was wired without it, so a rider on page 2 who widened the scope was
   * looking at page 2 of a longer list — the newest sessions in the sport they
   * had just added were on the page above and they were never shown them.
   *
   * Four quick logs, which is exactly a Rookie month, so the feed has two pages
   * at three a page.
   */
  await newRider(page, true);
  for (let i = 0; i < 4; i += 1) await logAQuickSession(page);

  await page.goto('/progress/sessions');
  const pager = page.getByRole('navigation', { name: 'Pages' });
  await pager.getByRole('button', { name: 'Page 2' }).click();
  await expect(page.getByText('Showing 4–4 of 4')).toBeVisible();

  await page.getByLabel('Show sessions for').selectOption('all');
  await expect(page.getByText('Showing 1–3 of 4')).toBeVisible();
});
