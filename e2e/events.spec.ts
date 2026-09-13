import { SPORT_IDS } from '@landit/core';
import { expect, test, type Page } from '@playwright/test';

import { e2eSuperuser, seedLibrary } from './support/seed-library';
import { seedSchedule } from './support/seed-schedule';
import { finishOnboarding, pickEverySport } from './support/onboarding';

/**
 * Events (T12), for a rider on the free plan.
 *
 * Three things worth pinning to the rendered page:
 *
 * - **"I'm going" survives a reload**, which is the difference between a row in
 *   `event_attendance` and a `useState`.
 * - **A finished event is only ever in the archive**, and the calendar never
 *   carries one. The two halves are two routes now (`/events` and
 *   `/events/past`), cut once in `@landit/core`, which is what closes the bug
 *   the design handoff records in the prototype.
 * - **A visitor who is not signed in reads the whole calendar**, because the
 *   `events` rule is `is_live = true` with no auth arm and a live event is
 *   public data. Only "I'm going" needs an account, and it is a sign-in link
 *   rather than a button that fails on click.
 * - **Nobody else's attendance is anywhere on the page.** There is no
 *   stranger-contact surface in this product (plan §6.1), and "who else is
 *   going" would be one. This is the kind of decision that gets added back by
 *   somebody who thinks it would be nice, so it is asserted rather than assumed.
 *
 * The events are seeded by the spec around today — see `seed-schedule.ts`.
 */

/*
 * The browser globals the geolocation tests below run against. This project's
 * e2e tsconfig has no DOM lib (see `shell.spec.ts`), and a call that is
 * supposed *never* to happen has to be observed at the API it would have gone
 * through. Declared narrowly, as types only — `declare` erases.
 */
declare const window: { __geoCalls: number };
declare const navigator: object;

interface StubPosition {
  coords: { latitude: number; longitude: number; accuracy: number };
  timestamp: number;
}

test.describe.configure({ mode: 'default' });

test.beforeAll(async () => {
  await seedLibrary();
  await seedSchedule();
});

const password = 'a-long-local-test-password';
const unique = () => Math.random().toString(36).slice(2, 10);

function birthDate(years: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * A rider who signs up and keeps onboarding's default single sport.
 *
 * The case the sport filter was rebuilt for (owner, 2026-09-12). `SportSwitch`
 * renders nothing below two sports and is fed by the rider's own
 * `users.sports`, so this rider used to reach `/events` with no tab row at all
 * and a lone pill reading "Good for Scooter" — every scooter-less event on the
 * calendar hidden, with no control on the screen that could bring it back.
 */
async function newRiderOneSport(page: Page): Promise<void> {
  await signUp(page);
  await finishOnboarding(page);
  await page.waitForURL('**/home');
}

async function signUp(page: Page): Promise<string> {
  const email = `e2e-events-${unique()}@landit.invalid`;
  await page.goto('/signup');
  await page.getByLabel('Your name').fill('Events Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Where you live').selectOption('GB');
  await page.getByLabel('Date of birth').fill(birthDate(24));
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.waitForURL('**/onboarding');
  return email;
}

async function newRider(page: Page): Promise<string> {
  const email = await signUp(page);
  await pickEverySport(page);
  await finishOnboarding(page);
  await page.waitForURL('**/home');
  return email;
}

/**
 * Put a rider down for an event **behind the screen**, as a superuser.
 *
 * The only way to reach the one state `/events/mine` exists to show that the UI
 * cannot produce: attendance at an event that has already happened. "I'm going"
 * is not offered on a finished row — it would be meaningless — so a rider's
 * "been to" list can only ever be built by an event passing while they were
 * down for it, which is a month of waiting rather than a test.
 */
async function markAttending(email: string, eventSlug: string): Promise<void> {
  const client = await e2eSuperuser();
  const rider = await client
    .collection('users')
    .getFirstListItem(client.filter('email = {:email}', { email }));
  const event = await client
    .collection('events')
    .getFirstListItem(client.filter('slug = {:slug}', { slug: eventSlug }));
  await client.collection('event_attendance').create({ user: rider.id, event: event.id });
}

/**
 * Replace the geolocation API with something that counts, before any of the
 * page's own script runs — so a call made during hydration is caught too.
 */
async function watchGeolocation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (position: StubPosition) => void) => {
          window.__geoCalls += 1;
          ok({
            coords: { latitude: 53.4084, longitude: -2.9916, accuracy: 40 },
            timestamp: Date.now(),
          });
        },
        watchPosition: () => {
          throw new Error('watchPosition must never be used: it is a live tracking session.');
        },
        clearWatch: () => {},
      },
    });
  });
}

const geoCalls = (page: Page) => page.evaluate(() => window.__geoCalls);

test('the list shows an upcoming event with its date block and its details', async ({ page }) => {
  await newRider(page);
  await page.goto('/events');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('What’s coming up');
  await expect(page.getByText('E2E Northern Jam')).toBeVisible();
  await expect(page.getByText('Projekts MCR · Manchester · All levels')).toBeVisible();

  await page.getByRole('button', { name: 'Details' }).first().click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Where', { exact: true })).toBeVisible();
  await expect(modal.getByText('Projekts MCR, Manchester')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});

test('"I’m going" sticks across a reload', async ({ page }) => {
  await newRider(page);
  await page.goto('/events');

  /*
   * Scoped to the Jam's own row. The calendar used to hold a single upcoming
   * event, so a bare "I'm going" was unambiguous; the seed gained a second one
   * on 2026-09-12 (the BMX-only comp the sport filter needs in order to have
   * something to hide), and an unscoped locator now finds two buttons and
   * fails on strict mode — the locator doing its job.
   */
  const jam = page.locator('[class*="row"]').filter({ hasText: 'E2E Northern Jam' });
  await expect(page.getByText('E2E Northern Jam')).toBeVisible();
  await jam.getByRole('button', { name: "I'm going" }).click();
  await expect(jam.getByRole('button', { name: '✓ Going' })).toBeVisible({ timeout: 15_000 });

  // The toast fires only after `setAttendanceAction` resolves (EventsScreen's
  // startTransition awaits it), so it is the one signal on this screen the
  // server produced — the ✓ label above and the tally below are optimistic
  // client state. Waiting here means the reload cannot abort the write in
  // flight, which is what made this test flaky under local parallelism
  // (issue #121). Straight apostrophe: the toast string, not the JSX &rsquo;.
  await expect(page.getByText("You're down for E2E Northern Jam.")).toBeVisible({
    timeout: 15_000,
  });

  await page.reload();
  await expect(
    page
      .locator('[class*="row"]')
      .filter({ hasText: 'E2E Northern Jam' })
      .getByRole('button', { name: '✓ Going' }),
  ).toBeVisible();
  await expect(page.getByText(/You’re down for 1 event/)).toBeVisible();
});

/*
 * The archive (`feat-events-archive`).
 *
 * The design handoff records the prototype's bug as a real one: its upcoming
 * list carried events that had already happened and its past view carried ones
 * that had not. The cut itself is proved as a property in
 * `packages/core/src/rules/events.test.ts`; what these assert is that the
 * *screens* are wired to it — a correct rule reached through the wrong route
 * would pass there and fail here.
 */
test('a finished event is only ever in the archive', async ({ page }) => {
  await newRider(page);
  await page.goto('/events');

  await expect(page.getByText('E2E Northern Jam')).toBeVisible();
  await expect(page.getByText('E2E Last Month Session')).toHaveCount(0);

  await page.getByRole('link', { name: /^Past/ }).click();
  await page.waitForURL('**/events/past');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Events that have already happened',
  );
  await expect(page.getByText('E2E Last Month Session')).toBeVisible();
  // And never the other way round: the calendar's event is not in the archive.
  await expect(page.getByText('E2E Northern Jam')).toHaveCount(0);

  // "Over" in words, not only in red — colour never carries meaning alone.
  await expect(page.getByText('Over', { exact: true })).toBeVisible();
  // "I'm going" is meaningless once it has happened; the page is offered instead.
  await expect(page.getByRole('link', { name: 'Full page →' })).toBeVisible();
  await expect(page.getByRole('button', { name: "I'm going" })).toHaveCount(0);
});

test('the archive index only offers corners that hold something', async ({ page }) => {
  await newRider(page);
  await page.goto('/events/past');

  const year = new Date(Date.now() - 20 * 86_400_000).getUTCFullYear();

  // Sheffield in that year holds the seeded past session, so it is a pill.
  const corner = page.getByRole('link', { name: /Sheffield/ });
  await expect(corner).toBeVisible();
  /*
   * And it is the town on its own. A corner holding one event is nearly every
   * corner, so a "1" beside each of them is a digit on every pill that
   * separates none of them (2026-09-13); the count is drawn only from two up.
   */
  await expect(corner).toHaveText('Sheffield');
  await corner.click();
  await page.waitForURL(`**/events/past/${year}/sheffield`);
  await expect(page.getByText('E2E Last Month Session')).toBeVisible();
  // A published corner is a real page and stays crawlable — the whole reason
  // for keeping finished events online.
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);

  /*
   * A corner nobody has published still answers, with the design's empty state
   * rather than a 500 — and it carries `noindex`, so a hand-typed combination
   * can never become an indexed thin page (Rachid, 2026-09-06, in chat).
   */
  const response = await page.goto('/events/past/2019/sheffield');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { level: 2, name: /No past events listed/ }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
});

test('the calendar opens on every sport, whatever the rider rides', async ({ page }) => {
  /*
   * The defect (owner, 2026-09-12: "it should default to every sport… but also
   * it only shows every sport or good for skate. Where are the other options?").
   *
   * A rider who records one sport got a calendar filtered to it, and a filter
   * they could not widen past two states — the tab row that chose the sport is
   * not rendered below two sports. Both halves are asserted here: what the
   * screen opens showing, and what it offers.
   */
  await newRiderOneSport(page);
  await page.goto('/events');

  // An event for a sport this rider does not ride is on the calendar anyway,
  // because the calendar is what is on and not what they ride.
  await expect(page.getByText('E2E BMX Only Comp')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Every sport' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // And every sport is offered, to a rider who rides one of them.
  const row = page.getByRole('group', { name: 'Filter events by sport' });
  await expect(row.getByRole('button')).toHaveCount(SPORT_IDS.length + 1);
  // The global tab row is gone from this screen — the filter row replaced it.
  await expect(page.getByRole('tablist', { name: 'Events by sport' })).toHaveCount(0);
});

test('the sport pills narrow the calendar, one sport or several', async ({ page }) => {
  /*
   * "Pick everything, or one of each, or multiple" (owner, 2026-09-12). The
   * control this replaced could say one sport or all of them and nothing in
   * between.
   */
  await newRider(page);
  await page.goto('/events');

  const row = page.getByRole('group', { name: 'Filter events by sport' });
  const bmxOnly = page.getByText('E2E BMX Only Comp');
  const everySport = page.getByText('E2E Northern Jam');

  // One sport: the BMX-only comp goes when the calendar is narrowed to skate,
  // and the event that is good for every sport stays.
  await row.getByRole('button', { name: /^Skate/ }).click();
  await expect(bmxOnly).toHaveCount(0);
  await expect(everySport).toBeVisible();

  // Several: adding BMX brings it back rather than replacing skate. Any of the
  // chosen sports matches, so this is both calendars at once.
  await row.getByRole('button', { name: /^BMX/ }).click();
  await expect(row.getByRole('button', { name: /^Skate/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(bmxOnly).toBeVisible();
  await expect(everySport).toBeVisible();

  // And back to everything, which is where it started.
  await page.getByRole('button', { name: 'Every sport' }).click();
  await expect(row.getByRole('button', { name: /^BMX/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(bmxOnly).toBeVisible();
});

test('the kind pills offer the kinds the half on screen actually holds', async ({ page }) => {
  await newRider(page);
  await page.goto('/events');

  // The calendar holds a Comp and nothing else, so no pill on it can find
  // nothing — and the archive's Session is not offered here.
  await page.getByRole('button', { name: 'Comp', exact: true }).click();
  await expect(page.getByText('E2E Northern Jam')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Session', exact: true })).toHaveCount(0);

  await page.goto('/events/past');
  await page.getByRole('button', { name: 'Session', exact: true }).click();
  await expect(page.getByText('E2E Last Month Session')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Comp', exact: true })).toHaveCount(0);
});

test('an event row is a link to its own page, and says which door it is', async ({ page }) => {
  await newRider(page);
  await page.goto('/events');

  // `?from=list` is what lets `event_page_opened` tell a row from the modal's
  // CTA. Three fixed strings decided on the server; nothing a reader typed.
  await expect(page.getByRole('link', { name: 'E2E Northern Jam' })).toHaveAttribute(
    'href',
    '/events/e2e-jam?from=list',
  );
});

test('the Details modal has an address, and the back button closes it', async ({ page }) => {
  await newRider(page);
  await page.goto('/events');

  const details = page.getByRole('button', { name: 'Details' }).first();
  await details.click();

  // Linkable (Rachid, 2026-09-06, in chat).
  await expect(page).toHaveURL(/\?event=e2e-jam$/);
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('link', { name: 'View full page →' })).toHaveAttribute(
    'href',
    '/events/e2e-jam?from=modal_cta',
  );
  // The title is a link to the same page, which is the design's second door.
  await expect(modal.getByRole('link', { name: 'E2E Northern Jam' })).toHaveAttribute(
    'href',
    '/events/e2e-jam?from=modal_cta',
  );

  // Back closes it, because opening pushed exactly one history entry.
  await page.goBack();
  await expect(modal).toHaveCount(0);
  await expect(page).toHaveURL(/\/events$/);

  // Escape closes it too, and puts focus back on the button that opened it.
  await details.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(details).toBeFocused();
});

test('the modal opens from its own address, for somebody arriving on the link', async ({
  page,
}) => {
  await newRider(page);
  await page.goto('/events?event=e2e-jam');

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Projekts MCR, Manchester')).toBeVisible();

  /*
   * Close on a modal nobody navigated to must not walk the reader off the site.
   * It replaces the address rather than going back, so the list is still there.
   */
  await modal.getByRole('button', { name: 'Close' }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByText('E2E Northern Jam')).toBeVisible();
});

test('no other rider appears anywhere on the events screen', async ({ page }) => {
  await newRider(page);
  await page.goto('/events');

  // Plan §6.1: no discovery, no directory, no way to see who else is going.
  await expect(page.getByText(/going with/i)).toHaveCount(0);
  await expect(page.getByText(/riders going/i)).toHaveCount(0);
  await expect(page.getByText(/attendees/i)).toHaveCount(0);
});

test('a visitor who is not signed in reads the whole calendar', async ({ page }) => {
  // Deliberately no `newRider`. This is the anonymous read, which is the API
  // rule's doing rather than the page's — `events` is `is_live = true` with no
  // auth arm, like `spots`, and unlike `announcements` beside it.
  await page.goto('/events');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('What’s coming up');
  await expect(page.getByText('E2E Northern Jam')).toBeVisible();

  // Every filter still works without an account, and so does the archive:
  // `/events/past` is public for exactly the reason the calendar is, and it is
  // the half a search result is most likely to land a stranger on.
  await page.getByRole('link', { name: /^Past/ }).click();
  await page.waitForURL('**/events/past');
  await expect(page.getByText('E2E Last Month Session')).toBeVisible();
});

/*
 * A rider's own events — the third tab (Rachid, 2026-09-13, in chat).
 *
 * "I'm going" was write-only: a rider could mark an event and the only thing
 * the product said back was a counter at the foot of the calendar. What these
 * assert is that the tab is wired to the rider's own attendance and to nobody
 * else's — the split between the two tenses is proved as a property in
 * `packages/core/src/rules/events.test.ts`.
 */
test('a rider’s own events get a tab, in both tenses', async ({ page }) => {
  const email = await newRider(page);
  // The one state the screen cannot produce for itself: attendance at an event
  // that is already over.
  await markAttending(email, 'e2e-gone');
  await page.goto('/events');

  const tab = page.getByRole('link', { name: /^Mine/ });
  await expect(tab).toBeVisible();

  const jam = page.locator('[class*="row"]').filter({ hasText: 'E2E Northern Jam' });
  await jam.getByRole('button', { name: "I'm going" }).click();
  await expect(page.getByText("You're down for E2E Northern Jam.")).toBeVisible({
    timeout: 15_000,
  });
  // The count moves in the same frame as the button turns green: a number that
  // needed a reload would read as the press not having worked.
  await expect(tab).toContainText('2');

  await tab.click();
  await page.waitForURL('**/events/mine');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your events');

  // Both tenses, under their own headings and in that order — what is next
  // first, because "what am I doing next" is the question the tab answers.
  await expect(page.getByText('Coming up', { exact: true })).toBeVisible();
  await expect(page.getByText('Been to', { exact: true })).toBeVisible();
  // By role, because the "You're down for E2E Northern Jam" toast outlives the
  // click through to this tab and a bare text match finds it too.
  await expect(page.getByRole('link', { name: 'E2E Northern Jam' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'E2E Last Month Session' })).toBeVisible();
  // And nothing they did not mark, however much of the calendar it is.
  await expect(page.getByRole('link', { name: 'E2E BMX Only Comp' })).toHaveCount(0);

  // Plan §6.1 again, on the one screen in the product that is a list of a
  // rider's plans: it is theirs, and it says so.
  await expect(page.getByText(/Only you can see this/)).toBeVisible();
  await expect(page.getByText(/riders going/i)).toHaveCount(0);
});

test('a rider who has marked nothing is told what the button does', async ({ page }) => {
  await newRider(page);
  await page.goto('/events/mine');

  // Not "nothing matches that filter": there is no filter, there is a feature
  // they have not used, and the copy has to name the button that fills this.
  await expect(
    page.getByRole('heading', { level: 2, name: /You haven’t marked anything yet/ }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /See what’s coming up/ })).toBeVisible();
});

test('the Mine tab is not offered to a visitor, and cannot be read by one', async ({ page }) => {
  await page.goto('/events');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('What’s coming up');
  // A tab that could only ever read "Mine 0" and lead to a sign-in wall is an
  // advert for a locked door.
  await expect(page.getByRole('link', { name: /^Mine/ })).toHaveCount(0);

  // And the address itself is one rider's attendance, which is nobody else's
  // to read: `/events` and `/events/past` are public, this one is not.
  await page.goto('/events/mine');
  await page.waitForURL('**/signin?next=*');
  expect(new URL(page.url()).searchParams.get('next')).toBe('/events/mine');
});

test('a visitor is offered sign-in where a rider is offered "I’m going"', async ({ page }) => {
  await page.goto('/events');

  // The one control that needs an account is a link back to this page, not a
  // button that looks live and loses the rider's filters on click.
  const link = page.getByRole('link', { name: 'Sign in to save' }).first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', `/signin?next=${encodeURIComponent('/events')}`);
  await expect(page.getByRole('button', { name: "I'm going" })).toHaveCount(0);

  await link.click();
  await page.waitForURL('**/signin?next=*');
});

/*
 * Children's code standard 10 (plan §6.4), on the calendar. Signed out, because
 * nothing here needs an account and the promise is owed to a visitor too.
 *
 * Neither test asserts the *order* of the list: the seeded events carry no
 * coordinates, so the screen keeps them in date order by its own rule about
 * events nobody has plotted. What is asserted is the part the resume changed —
 * that a position is taken only when the browser already allows it, that the
 * rider is told both that their location is in use and that the ordering has
 * changed, and that they can end it.
 */
test('the calendar never asks for the rider’s location unless they press for it', async ({
  page,
}) => {
  await watchGeolocation(page);
  await page.goto('/events');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('What’s coming up');

  // No permission granted to this context, so the load-time resume must decline
  // to act: on a browser sitting at `prompt`, a `getCurrentPosition` call *is*
  // the permission dialog. Checked before hydration is waited for, on purpose.
  expect(await geoCalls(page)).toBe(0);

  const sort = page.getByRole('group', { name: 'Sort events' });
  const nearest = sort.getByRole('button', { name: 'Nearest' });
  // The control is on the screen from the first paint, and pressing it is what
  // asks — a pre-selected "Nearest" would be a dialog nobody opened.
  await expect(nearest).toHaveAttribute('aria-pressed', 'false');
  await expect(sort.getByRole('button', { name: 'Soonest' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('Nearest first')).toHaveCount(0);

  await nearest.click();
  expect(await geoCalls(page)).toBe(1);
  await expect(page.getByText('Using your location')).toBeVisible();
  await expect(page.getByText('Nearest first')).toBeVisible();

  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByText('Using your location')).toHaveCount(0);
  await expect(page.getByText('Nearest first')).toHaveCount(0);
  // And the control says so rather than leaving "Nearest" lit over a list that
  // is back in date order.
  await expect(nearest).toHaveAttribute('aria-pressed', 'false');
});

test('the calendar goes back to date order without giving up the distances', async ({
  page,
  context,
}) => {
  /*
   * The defect this closes (Rachid, 2026-09-13, in chat: "events page should
   * have sort by closest / soonest").
   *
   * Holding a position used to re-sort the whole calendar into distance order
   * with no way back except turning location off — which took the "about 3 mi
   * away" labels with it. A calendar in date order is a promise (the next thing
   * you could go to is the top row) and a rider has to be able to have both.
   */
  await context.grantPermissions(['geolocation']);
  await watchGeolocation(page);
  await page.goto('/events');

  const sort = page.getByRole('group', { name: 'Sort events' });
  await expect(page.getByText('Nearest first')).toBeVisible();

  await sort.getByRole('button', { name: 'Soonest' }).click();
  await expect(page.getByText('Nearest first')).toHaveCount(0);
  await expect(sort.getByRole('button', { name: 'Nearest' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  // The whole point: the position is still in use, so the rows can still say
  // how far away they are. Turning location off was the old way back.
  await expect(page.getByText('Using your location')).toBeVisible();
  expect(await geoCalls(page)).toBe(1);

  // And back again, without asking the browser a second time.
  await sort.getByRole('button', { name: 'Nearest' }).click();
  await expect(page.getByText('Nearest first')).toBeVisible();
  expect(await geoCalls(page)).toBe(1);
});

test('the calendar opens nearest-first when the browser already allows it', async ({
  page,
  context,
}) => {
  // The rider granted this in their own browser on an earlier visit, which is
  // the only state the resume acts on (§6.4 standard 10, as amended).
  await context.grantPermissions(['geolocation']);
  await watchGeolocation(page);
  await page.goto('/events');

  // No press anywhere in this test. Both notices are the assertion: a calendar
  // silently re-sorted from date order owes the rider the second one.
  await expect(page.getByText('Using your location')).toBeVisible();
  await expect(page.getByText('Nearest first')).toBeVisible();
  expect(await geoCalls(page)).toBe(1);

  // Still switches off for good — the permission is still granted, so a resume
  // that ignored the press would come straight back and leave the rider unable
  // to turn their location off at all.
  await page.getByRole('button', { name: 'Turn off' }).click();
  await expect(page.getByText('Using your location')).toHaveCount(0);
  await expect(
    page.getByRole('group', { name: 'Sort events' }).getByRole('button', { name: 'Soonest' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(await geoCalls(page)).toBe(1);
});

test('the What’s on drawer is the way back to spots on a phone', async ({ page }) => {
  // The other half of the pair `e2e/spots.spec.ts` checks. A rider who taps
  // the bottom bar's "What's on" lands on Spots, and if Events could not get
  // them back the fold would be a one-way door.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/events');

  const drawer = page.getByRole('group', { name: 'What’s on', exact: true });
  await expect(drawer.getByRole('link', { name: 'Events', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await drawer.getByRole('link', { name: 'Spots', exact: true }).click();
  await page.waitForURL('**/spots');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Where to ride');
});

test('on a phone, tapping the lit cell reopens the drawer instead of moving the rider', async ({
  page,
}) => {
  /*
   * The one case where a bottom-bar cell is not a link.
   *
   * A rider on Events who taps "What's on" is asking what else is in here, and
   * the old bar answered by dragging them to Spots. Now it shows them the two
   * names and leaves them where they are — which is also the only way back to
   * the drawer once it has been dismissed.
   */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/events');

  const drawer = page.getByRole('group', { name: 'What’s on', exact: true });
  const cell = page
    .getByRole('navigation', { name: 'Main, compact', exact: true })
    .getByRole('link', { name: 'What’s on', exact: true });

  // Dismissed by a tap on the page, which is how a rider gets it out of the way.
  await page.getByRole('heading', { level: 1 }).click();
  await expect(drawer).toBeHidden();
  await expect(cell).toHaveAttribute('aria-expanded', 'false');

  await cell.click();
  await expect(drawer).toBeVisible();
  await expect(cell).toHaveAttribute('aria-expanded', 'true');
  // Still on Events: the tap opened the drawer and navigated nowhere.
  expect(new URL(page.url()).pathname).toBe('/events');
});
