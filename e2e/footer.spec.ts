import { expect, test } from '@playwright/test';

/**
 * The site footer's responsive behaviour (plan §7 T5, thirteenth divergence).
 *
 * Driven through `/legal/privacy` rather than the landing page: the footer is
 * on both, but the landing page's marquee is deliberately wider than the
 * viewport and animates, so the one assertion here that reads the document's
 * scroll width could not be trusted on it.
 *
 * Everything below 760px is CSS and nothing else — there is no component state
 * to unit-test and no server to ask — so a browser at a phone's width is the
 * only place the fold can be proved. That is the whole reason this file exists:
 * delete the media query and `pnpm build`, `pnpm test` and `pnpm lint` all stay
 * green while a rider gets 906px of footer back.
 */

const PAGE = '/legal/privacy';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1200, height: 900 };

test('below 760px the columns are folded, and a heading opens one at a time', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(PAGE);

  const footer = page.getByRole('contentinfo');
  const theApp = footer.getByRole('navigation', { name: 'The app' });
  const legal = footer.getByRole('navigation', { name: 'Legal' });

  /*
   * Hidden, not absent: the links are in the markup for a crawler and for a
   * stylesheet that never arrives, and only the phone's media query hides them.
   * Located by `href` rather than by role, because `display: none` takes an
   * element out of the accessibility tree — `getByRole` would find nothing
   * here and `toBeHidden()` would pass on an empty footer, which is exactly the
   * regression this file is meant to catch.
   */
  const trickLibrary = theApp.locator('a[href="/library"]');
  await expect(trickLibrary).toHaveCount(1);
  await expect(trickLibrary).toBeHidden();
  await expect(footer.locator('nav a')).toHaveCount(17);

  await footer.getByText('The app', { exact: true }).click();

  await expect(trickLibrary).toBeVisible();
  await expect(theApp.getByRole('link', { name: 'Spots' })).toBeVisible();
  // One heading opens one section: this is four disclosures, not a tab strip.
  await expect(legal.getByRole('link', { name: 'Cookies' })).toBeHidden();

  await footer.getByText('The app', { exact: true }).click();
  await expect(trickLibrary).toBeHidden();
});

test('the fold is a phone layout only: above 760px every link is already there', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await page.goto(PAGE);

  const footer = page.getByRole('contentinfo');

  for (const link of ['Trick library', 'Crew', 'Safeguarding', 'Cookies']) {
    await expect(footer.getByRole('link', { name: link, exact: true })).toBeVisible();
  }

  /*
   * The checkboxes are `display: none` up here rather than merely unstyled, so
   * they are out of the tab order and out of the accessibility tree. A rider on
   * a desktop tabbing through the footer should meet seventeen links and no
   * controls — the fold does not exist at this width and should not be
   * announced as though it did.
   */
  await expect(footer.getByRole('checkbox')).toHaveCount(0);
});

test('reporting is never behind the fold', async ({ page }) => {
  /*
   * T18 and plan §6.1: the report route has to be easy to find without an
   * account, and "easy" is what stops being true the moment it is a tap inside
   * a collapsed section. It is in the Company column *and* in the bottom strip
   * for exactly that reason, so this asserts the bottom strip's copy at a
   * phone's width with nothing opened.
   */
  await page.setViewportSize(PHONE);
  await page.goto(PAGE);

  const footer = page.getByRole('contentinfo');

  // Both copies by `href`, for the reason the first test gives: the folded one
  // is not in the accessibility tree, so only an attribute locator can see that
  // it is there at all.
  const report = footer.locator('a[href="/report"]');
  await expect(report).toHaveCount(2);
  await expect(report.first()).toBeHidden();
  await expect(report.last()).toBeVisible();
});

test('the footer never widens the page, folded or opened', async ({ page }) => {
  /*
   * The same assertion `shell.spec.ts` makes about the top bar, and for the
   * same reason: a footer that overflows gives the *whole document* a sideways
   * scroll, on every page it is on. 320px is the narrowest phone still worth
   * supporting and the width at which the bottom strip's three links and the
   * helmet line have the least room.
   */
  await page.goto(PAGE);
  const root = page.locator('html');
  const footer = page.getByRole('contentinfo');

  for (const width of [320, 360, 390, 430, 600, 759, 768, 900, 1000, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });

    await expect
      .poll(() => root.evaluate((el) => el.scrollWidth - el.clientWidth), {
        message: `the document scrolls sideways at ${width}px`,
      })
      .toBe(0);
  }

  // And with every section opened, which is the tallest and widest the phone
  // layout ever gets.
  await page.setViewportSize({ width: 320, height: 900 });
  for (const title of ['The app', 'Riders', 'Company', 'Legal']) {
    await footer.getByText(title, { exact: true }).click();
  }
  await expect.poll(() => root.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
});
