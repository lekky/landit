import { expect, test } from '@playwright/test';

import { seedSchedule } from './support/seed-schedule';

/**
 * An event's own page, `/events/[slug]`.
 *
 * Signed out throughout, deliberately: the page's whole reason for existing is
 * to be a public address somebody can share, search for and crawl, so the
 * interesting reader is the one with no account.
 *
 * Four things are pinned here and nowhere else:
 *
 * - **The date state is in the server's markup**, not painted after hydration.
 *   That is checked by fetching the HTML rather than by looking at the rendered
 *   page — a crawler and a link preview see only what the server sent, and an
 *   "over" badge added by JavaScript would be indexed as "upcoming" for ever.
 * - **A finished event keeps its page**, its stamp and its structured data.
 *   Past events stay indexed on purpose (Rachid, 2026-09-06, in chat).
 * - **Nobody else's attendance is on the page**, and the sentence that says so
 *   is present. This is the kind of copy somebody trims as redundant, so it is
 *   asserted rather than assumed (plan §6.1).
 * - **A slug nobody has is a 404**, not a page about nothing.
 *
 * The two events come from `seed-schedule.ts`, dated relative to today, so
 * nothing here has an expiry date. It deliberately seeds no events of its own:
 * `events.spec.ts` relies on exactly one upcoming event being on the list.
 */

/*
 * Serial, like `events.spec.ts` and for the same reason: `fullyParallel` puts
 * each test in its own worker, every worker runs `beforeAll`, and four copies
 * of `seedSchedule` racing each other on one PocketBase is a 403 in a fixture
 * rather than a failure in anything under test.
 */
test.describe.configure({ mode: 'default' });

test.beforeAll(async () => {
  await seedSchedule();
});

test('an upcoming event has a page of its own, readable signed out', async ({ page }) => {
  await page.goto('/events/e2e-jam');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'E2E Northern Jam, Manchester',
  );
  await expect(page.getByText('Projekts MCR · Manchester')).toBeVisible();
  await expect(page.getByText('Days away')).toBeVisible();

  // The listing's own facts, promoted out of the modal.
  await expect(page.getByText('Jam format, open practice all day')).toBeVisible();
  await expect(page.getByText('£8 entry · 40 riders')).toBeVisible();
  await expect(page.getByText('As listed by the organiser')).toBeVisible();

  // The organiser published no address or phone for this one, and the page says
  // so rather than leaving a label with nothing after it.
  await expect(page.getByText('No address listed')).toBeVisible();
  await expect(page.getByText('No phone listed')).toBeVisible();
});

test('the page never says who else is going, and says that it never will', async ({ page }) => {
  await page.goto('/events/e2e-jam');

  await expect(page.getByText(/no attendee list and never shows who is going/i)).toBeVisible();

  // A visitor gets a way in rather than a button that fails on click.
  await expect(page.getByRole('link', { name: 'Sign in to save this' })).toBeVisible();
});

test('a finished event keeps its page, and says it is finished', async ({ page }) => {
  await page.goto('/events/e2e-gone');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'E2E Last Month Session, Sheffield',
  );
  await expect(page.getByText('This event has finished')).toBeVisible();
  await expect(page.getByText('Kept online for the record')).toBeVisible();
});

test('the date state and the structured data are in the HTML the server sent', async ({
  request,
}) => {
  const upcoming = await request.get('/events/e2e-jam');
  expect(upcoming.status()).toBe(200);
  const upcomingHtml = await upcoming.text();
  expect(upcomingHtml).toContain('Days away');
  expect(upcomingHtml).toContain('"@type":"Event"');
  expect(upcomingHtml).toContain('"name":"E2E Northern Jam"');

  const over = await request.get('/events/e2e-gone');
  expect(over.status()).toBe(200);
  const overHtml = await over.text();
  expect(overHtml).toContain('This event has finished');
  expect(overHtml).toContain('Kept online for the record');
  // A past event keeps its markup — the page is the archive, not a redirect.
  expect(overHtml).toContain('"@type":"Event"');
});

test('a slug nobody has is a 404, not a page about nothing', async ({ page }) => {
  const response = await page.goto('/events/no-such-event-anywhere');
  expect(response?.status()).toBe(404);
});
