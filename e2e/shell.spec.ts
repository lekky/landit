import { SPORT_IDS } from '@landit/core';
import { expect, test } from '@playwright/test';

/**
 * The app shell, driven through `/design/shell`.
 *
 * That page exists because the shell ships a wave before any screen does
 * (T7 onward), so without it there is nothing to render the frame around and
 * nothing for a test to click. It is not in the navigation and it is noindexed.
 */

const SHELL = '/design/shell';

test('the top bar carries the nav above 860px and hands over to the bottom bar below it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(SHELL);

  const topNav = page.getByRole('navigation', { name: 'Main', exact: true });
  const bottomNav = page.getByRole('navigation', { name: 'Main, compact', exact: true });

  await expect(topNav).toBeVisible();
  await expect(bottomNav).toBeHidden();

  await page.setViewportSize({ width: 800, height: 800 });
  await expect(topNav).toBeHidden();
  await expect(bottomNav).toBeVisible();
});

test('the top bar never widens the page, at any width the nav is on show', async ({ page }) => {
  /*
   * Issue #57. Between the 860px bottom-bar breakpoint and roughly 1000px the
   * wordmark, nine nav items, streak chip and avatar did not fit, and because a
   * flex item's `min-width` is `auto` the excess left the right-hand edge and
   * gave the *whole document* a horizontal scrollbar — on every signed-in screen
   * at once, since they all inherit this shell.
   *
   * 861 and 1040 are the edges of the band the stylesheet tightens; 934 is the
   * width the bug was reported at; the outer two prove the untouched sizes are
   * still untouched. The assertion is the document's own scroll width, which is
   * the thing a rider would actually see go wrong, rather than any of the
   * numbers the fix happens to be made of.
   */
  await page.goto(SHELL);

  // Read through locators rather than `page.evaluate`: this project's e2e
  // tsconfig has no DOM lib, so `document` and `HTMLElement` are not names here.
  // An element handed to `locator.evaluate` is typed by Playwright itself, and
  // `scrollWidth` / `clientWidth` come with it.
  const root = page.locator('html');

  for (const width of [861, 900, 934, 1040, 1041, 1440]) {
    await page.setViewportSize({ width, height: 800 });

    await expect
      .poll(() => root.evaluate((el) => el.scrollWidth - el.clientWidth), {
        message: `the document scrolls sideways at ${width}px`,
      })
      .toBe(0);

    const nav = page.getByRole('navigation', { name: 'Main', exact: true });

    /*
     * And the nav does not quietly swallow the overflow either.
     *
     * `.nav` carries `min-width: 0` and its own `overflow-x` as a safety net, so
     * the check above passes on that alone — it did, with the tightening
     * removed, which is exactly what a net is for and exactly why it cannot be
     * the whole assertion. This is the half that proves all nine items really
     * fit: a nav that scrolls has items nobody can see, and Playwright counts
     * one scrolled out of view as visible.
     */
    await expect
      .poll(() => nav.evaluate((el) => el.scrollWidth - el.clientWidth), {
        message: `the nav itself scrolls at ${width}px, so an item is out of view`,
      })
      .toBe(0);

    // Fitting by dropping items would pass both checks and fail the point of
    // them: all nine stay on show, only closer together.
    await expect(nav.locator('> *'), `nine nav items at ${width}px`).toHaveCount(9);
  }
});

test('the bottom bar is five sections, in the order a phone wants them', async ({ page }) => {
  /*
   * Five, because `.mobnav` is `repeat(5, 1fr)` and the design specifies five
   * (handoff, Responsive). But five *sections*, not the first five entries of
   * the top bar — which is what this used to assert, and what left Challenge,
   * Events, Spots and Plans with no navigation entry at all below 861px.
   *
   * The order is a phone's: What's on sits in the middle cell, the easiest
   * reach one-handed, because it is the reason to open the app while standing
   * outside a skatepark.
   */
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto(SHELL);

  /*
   * `> a`, not `> *`: the bar's own children are the five cells, but the
   * section drawer is a sixth child of the same element — absolutely positioned
   * against `.mobnav`, which is what sits it exactly on the bar's top edge
   * without measuring a height that moves with the safe-area inset. It is not a
   * cell, and counting it as one would make this test read as a regression. A
   * sixth *link* still fails, which is what this test is actually guarding.
   */
  const items = page.getByRole('navigation', { name: 'Main, compact', exact: true }).locator('> a');
  await expect(items).toHaveCount(5);
  await expect(items).toHaveText([/Home/, /Tricks/, /What’s on/, /Progress/, /Crew/]);

  for (const [name, href] of [
    ['Home', '/home'],
    ['Tricks', '/library'],
    ['What’s on', '/spots'],
    ['Progress', '/progress'],
    ['Crew', '/crew'],
  ] as const) {
    await expect(
      page.getByRole('navigation', { name: 'Main, compact', exact: true }).getByRole('link', {
        name,
        exact: true,
      }),
    ).toHaveAttribute('href', href);
  }
});

test('no bottom-bar label wraps, down to the narrowest phone anyone still uses', async ({
  page,
}) => {
  /*
   * A wrapped label takes the row's height with it and pushes the icons out of
   * line. "What's on" is the longest of the five and the one that made this
   * worth measuring rather than eyeballing: about 58px of Barlow Condensed
   * against a 71px cell at 375px, and about 60px of cell at 320px.
   *
   * Measured as the label's own line count rather than as a width, because the
   * width the arithmetic predicts is the width in the font that loaded, and a
   * fallback font is exactly the case this is a net for.
   */
  for (const width of [430, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(SHELL);

    // `> a` for the reason the five-cell test above gives: the drawer is a
    // sibling of the cells, not one of them. This test is also what proves the
    // caret on a folded cell costs no height — it is absolutely positioned
    // precisely so that two cells of five cannot make the whole bar taller.
    const items = page
      .getByRole('navigation', { name: 'Main, compact', exact: true })
      .locator('> a');

    const heights = await items.evaluateAll((nodes) =>
      nodes.map((n) => Math.round(n.getBoundingClientRect().height)),
    );
    expect(new Set(heights).size, `the bottom bar's cells disagree on height at ${width}px`).toBe(
      1,
    );

    // Both halves are needed. `white-space: nowrap` means a label that does not
    // fit overflows its cell instead of wrapping it, and an overflow leaves
    // every cell the same height — so the heights above would say nothing.
    const overflow = await items.evaluateAll((nodes) =>
      nodes.map((n) => n.scrollWidth - n.clientWidth),
    );
    expect(overflow, `a bottom-bar label is wider than its cell at ${width}px`).toEqual(
      overflow.map(() => 0),
    );

    // And the bar itself does not push the document sideways at that width.
    const root = page.locator('html');
    await expect
      .poll(() => root.evaluate((el) => el.scrollWidth - el.clientWidth), {
        message: `the document scrolls sideways at ${width}px`,
      })
      .toBe(0);
  }
});

test('the avatar opens the four destinations that are not places to ride', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto(SHELL);

  const trigger = page.getByRole('button', { name: 'Your account and settings' });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await trigger.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();

  for (const [name, href] of [
    ['Your account', '/account'],
    ['Coach / parent view', '/coach'],
    ['Plans and pricing', '/plans'],
    // Footer-only before this, underneath a scrolled page. The OSA codes ask
    // for a reporting route that is easy to find (plan §6.1).
    ['Report something', '/report'],
  ] as const) {
    await expect(menu.getByRole('menuitem', { name, exact: true })).toHaveAttribute('href', href);
  }

  // And nothing about a staff portal, which is the visible half of the 404 an
  // ordinary rider meets at `/admin` (`lib/staff.ts`): no disabled row, no
  // greyed label, no mention. Five rows, not four: the fifth is Sign out, which
  // is not a destination and has its own test below.
  await expect(menu.getByRole('menuitem')).toHaveCount(5);
  await expect(menu.locator('a[role="menuitem"]')).toHaveCount(4);
  await expect(menu.getByRole('menuitem', { name: 'Admin portal' })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('a staff account gets a fifth item, the admin portal, drawn as staff', async ({ page }) => {
  /*
   * `?staff=1` is the preview page's staff sample rider — the real flag comes
   * from `users.role` through `app/(app)/layout.tsx`, and the gate that decides
   * whether `/admin` renders is `requireStaff` on the server either way. This
   * checks the drawing: that the row is there, last, pointing at the portal,
   * and in the portal's violet rather than passing for a rider destination.
   */
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto(`${SHELL}?staff=1`);

  await page.getByRole('button', { name: 'Your account and settings' }).click();
  const menu = page.getByRole('menu');

  const items = menu.getByRole('menuitem');
  await expect(items).toHaveCount(6);

  // Last of the *destinations* — Sign out sits below it and is not one.
  const links = menu.locator('a[role="menuitem"]');
  const admin = menu.getByRole('menuitem', { name: 'Admin portal', exact: true });
  await expect(admin).toHaveAttribute('href', '/admin');
  await expect(links).toHaveCount(5);
  await expect(links.last()).toHaveAttribute('href', '/admin');

  // `--violet` (#8a3be0), and the 3px keyline that separates the register.
  await expect(admin).toHaveCSS('color', 'rgb(138, 59, 224)');
  await expect(admin).toHaveCSS('border-top-width', '3px');
});

test('sign out is the last row of the menu, for staff and riders alike', async ({ page }) => {
  /*
   * The way out of the app used to be the account screen only, which on a phone
   * put it behind a screen a rider had to open in order to close the app. It is
   * a `button` in a form rather than a link, because it posts `signOutAction` —
   * the same one the account screen and the staff portal post to — so this
   * checks the row is a submit and that it is genuinely last, under the 3px
   * keyline that separates it from the destinations above.
   */
  await page.setViewportSize({ width: 800, height: 800 });

  for (const [what, url] of [
    ['a rider', SHELL],
    ['staff', `${SHELL}?staff=1`],
  ] as const) {
    await page.goto(url);
    await page.getByRole('button', { name: 'Your account and settings' }).click();
    const menu = page.getByRole('menu');

    const signOut = menu.getByRole('menuitem', { name: 'Sign out', exact: true });
    await expect(signOut, `${what} cannot see Sign out in the account menu`).toBeVisible();
    await expect(signOut).toHaveAttribute('type', 'submit');
    await expect(signOut).toHaveCSS('border-top-width', '3px');

    // Last, below the admin row where there is one.
    const items = menu.getByRole('menuitem');
    await expect(items.last()).toHaveText('Sign out');

    await page.keyboard.press('Escape');
  }
});

test('every nav item whose screen exists is a real link', async ({ page }) => {
  await page.goto(SHELL);

  // The nav's half of `landing.spec.ts`'s "a built screen is a real link".
  // Wave 5's four sessions each shipped a screen reachable by URL and left
  // `components/shell/nav.ts` alone, so that four concurrent rebases could not
  // drop a sibling's line from the one file that decides whether a screen has a
  // way in. `chore-wire-wave5-links` wired all five afterwards; this is what
  // stops one going missing.
  const nav = page.getByRole('navigation', { name: 'Main', exact: true });
  for (const [name, href] of [
    ['Home', '/home'],
    ['Tricks', '/library'],
    ['Progress', '/progress'],
    ['Stickers', '/stickers'],
    ['Crew', '/crew'],
    ['Challenge', '/challenge'],
    ['Events', '/events'],
    ['Spots', '/spots'],
    // T15's, and the last one. Every item in `components/shell/nav.ts` is now a
    // real link, so the "a screen that is not built yet is a label" half of this
    // rule no longer has an exemplar in the nav — it still has one in
    // `landing.spec.ts` while any footer entry is unbuilt.
    ['Plans', '/plans'],
  ] as const) {
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  }
});

test('the sport switch offers one tab per sport', async ({ page }) => {
  await page.goto(SHELL);
  const tabs = page.getByRole('tablist', { name: 'Sport', exact: true }).getByRole('tab');
  await expect(tabs).toHaveCount(SPORT_IDS.length);
});

test('switching sport holds across a reload', async ({ page }) => {
  await page.goto(SHELL);

  const tabs = page.getByRole('tablist', { name: 'Sport', exact: true }).getByRole('tab');
  const second = tabs.nth(1);
  const label = await second.innerText();

  await second.click();
  await expect(second).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  const afterReload = page
    .getByRole('tablist', { name: 'Sport', exact: true })
    .getByRole('tab')
    .nth(1);
  await expect(afterReload).toHaveAttribute('aria-selected', 'true');
  expect(await afterReload.innerText()).toBe(label);
});

test('three sport tabs still sit on one line on a 375px phone', async ({ page }) => {
  // The squeeze the plan flags for T5: at three sports the row has to survive
  // the narrowest phone without wrapping. Below 520px the labels shorten and
  // the trick-count notes are dropped to make room.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(SHELL);

  const tabs = page
    .getByRole('tablist', { name: 'Sport, three-sport layout check' })
    .getByRole('tab');
  await expect(tabs).toHaveCount(3);

  const tops = await tabs.evaluateAll((nodes) =>
    nodes.map((n) => Math.round(n.getBoundingClientRect().top)),
  );
  expect(new Set(tops).size).toBe(1);

  // Short label in, full label and note out. Both labels are in the DOM and the
  // stylesheet picks which one shows, so this asserts on visibility rather than
  // on text — the swap is the mechanism being tested.
  const skate = tabs.nth(1);
  await expect(skate.locator('.tab-short')).toBeVisible();
  await expect(skate.locator('.tab-full')).toBeHidden();
  await expect(skate.locator('.n')).toBeHidden();
});

test('a toast appears and clears itself', async ({ page }) => {
  await page.goto(SHELL);

  await page.getByRole('button', { name: 'Stage toast' }).click();
  const toast = page.getByText('Tailwhip · Every time');
  await expect(toast).toBeVisible();

  // The design specifies 3.2 seconds; allow for the render either side.
  await expect(toast).toBeHidden({ timeout: 6000 });
});

test('the modal opens and Escape closes it', async ({ page }) => {
  await page.goto(SHELL);

  await page.getByRole('button', { name: 'Open a modal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Shell preview modal' });
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

/*
 * Touch hygiene on a phone (#375). 390x844 is an iPhone 14 without Safari's
 * bars, the device the 2026-09-08 audit measured every one of these on.
 */
const PHONE = { width: 390, height: 844 };

test('on a phone, a toast sits above the bottom bar rather than on it', async ({ page }) => {
  // Measured before the fix: the whole toast on TRICKS and WHAT'S ON, 57px of
  // overlap, and the stack is `pointer-events: none`, so those cells were dead.
  await page.setViewportSize(PHONE);
  await page.goto(SHELL);

  await page.getByRole('button', { name: 'Stage toast' }).click();
  const toast = page.locator('.toast', { hasText: 'Tailwhip · Every time' });
  await expect(toast).toBeVisible();

  const bar = page.getByRole('navigation', { name: 'Main, compact', exact: true });
  const barTop = (await bar.boundingBox())!.y;

  // Polled, because a toast arrives on `tin`, which starts it 24px low: read
  // during the entrance, a toast that rests clear of the bar measures 9px into
  // it. The resting position is the one a rider reads for three seconds.
  await expect
    .poll(
      async () => {
        const box = await toast.boundingBox();
        return box ? box.y + box.height : Infinity;
      },
      { message: 'the toast overlaps the bottom bar' },
    )
    .toBeLessThanOrEqual(barTop);
});

test('on a phone, only the two newest toasts are drawn', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(SHELL);

  const stage = page.getByRole('button', { name: 'Stage toast' });
  const sticker = page.getByRole('button', { name: 'Sticker toast' });
  await stage.click();
  await sticker.click();
  await stage.click();

  // All three are in the stack — it is `role="status"`, and each was announced
  // as it arrived — but the oldest is no longer drawn over the page.
  const toasts = page.locator('.toasts > .toast');
  await expect(toasts).toHaveCount(3);
  await expect(toasts.nth(0)).toBeHidden();
  await expect(toasts.nth(1)).toBeVisible();
  await expect(toasts.nth(2)).toBeVisible();
});

test('on a phone, the footer scrolls clear of the bottom bar', async ({ page }) => {
  // `.page` pads for the fixed bar; the footer after it did not, so its last
  // row — the legal links — was 45px under the bar at the end of every page and
  // could not be reached. Found verifying #375's bigger footer targets.
  await page.setViewportSize(PHONE);
  await page.goto(SHELL);
  await page.locator('html').evaluate((el) => el.scrollTo(0, el.scrollHeight));

  const barTop = (await page
    .getByRole('navigation', { name: 'Main, compact', exact: true })
    .boundingBox())!.y;
  await expect
    .poll(
      () =>
        page
          .locator('footer')
          .locator('a, button')
          .evaluateAll((nodes) => Math.max(...nodes.map((n) => n.getBoundingClientRect().bottom))),
      { message: "the footer's last control is under the bottom bar" },
    )
    .toBeLessThanOrEqual(barTop);
});

test('on a phone, small buttons and sport tabs are 44px tall; on a desktop they are as drawn', async ({
  page,
}) => {
  await page.goto(SHELL);
  const small = page.getByRole('button', { name: 'Stage toast' });
  const tabs = page.getByRole('tablist', { name: 'Sport', exact: true }).getByRole('tab');

  await page.setViewportSize(PHONE);
  expect((await small.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  for (const height of await tabs.evaluateAll((nodes) =>
    nodes.map((n) => n.getBoundingClientRect().height),
  )) {
    expect(height, 'a sport tab is under 44px on a phone').toBeGreaterThanOrEqual(44);
  }

  // The floor is a phone's, not a new size for the design: the desktop keeps
  // the 36px `.btn.sm` the handoff drew.
  await page.setViewportSize({ width: 1200, height: 800 });
  expect((await small.boundingBox())!.height).toBeLessThan(44);
});

test('on a phone, no field is small enough for iOS to zoom the page into it', async ({ page }) => {
  /*
   * Below 16px, iOS zooms in on focus and never zooms back. `.field` held 16px
   * by convention and four screen modules slipped under it, so this plants the
   * exact shape that slipped — a field whose own class sets 14px — rather than
   * trusting today's screens to stay honest. A select and a textarea too:
   * written as a plain list, the floor lost to any class on those two.
   *
   * A string, not a function: this project's e2e tsconfig has no DOM lib.
   */
  await page.goto(SHELL);
  await page.evaluate(`(() => {
    const style = document.createElement('style');
    style.textContent = '.t375 { font-size: 14px }';
    document.head.append(style);
    const host = document.createElement('div');
    host.innerHTML =
      '<input class="t375" aria-label="t375 input">' +
      '<textarea class="t375" aria-label="t375 textarea"></textarea>' +
      '<div class="field"><select class="t375" aria-label="t375 select"><option>One</option></select></div>';
    document.body.append(host);
  })()`);

  const fields = page.getByLabel(/^t375 /);
  await expect(fields).toHaveCount(3);

  await page.setViewportSize(PHONE);
  for (const field of await fields.all()) {
    await expect(field).toHaveCSS('font-size', '16px');
  }
  // WebKit's grey rounded menulist is replaced by the square ink chevron.
  await expect(page.getByLabel('t375 select')).toHaveCSS('appearance', 'none');

  // A desktop has no focus zoom, and keeps whatever the screen drew.
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(page.getByLabel('t375 textarea')).toHaveCSS('font-size', '14px');
});

test('the viewport reaches under the notch, so the safe-area insets are real', async ({ page }) => {
  // Without `viewport-fit=cover` every `env(safe-area-inset-*)` is 0: the
  // installed app's status bar sat on the top bar and `.mobnav`'s home-indicator
  // padding did nothing. The insets themselves need a real iPhone to see.
  await page.goto(SHELL);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );
});

test.describe('on a touch screen', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test('a tapped button does not stay lifted, and the browser paints no tap flash', async ({
    page,
  }) => {
    /*
     * A touch browser leaves `:hover` on whatever was tapped. The audit measured
     * a tapped button still at `translate(-1px,-1px)` 600ms after the finger
     * lifted. This asserts on the media query first, because a context that did
     * not emulate `(hover: none)` would pass the rest without testing anything.
     */
    await page.goto(SHELL);
    expect(await page.evaluate(`matchMedia('(hover: none)').matches`)).toBe(true);

    const small = page.getByRole('button', { name: 'Stage toast' });
    await small.tap();
    await expect(page.locator('.toast', { hasText: 'Tailwhip · Every time' })).toBeVisible();

    await expect(small).toHaveCSS('transform', 'none');
    await expect(small).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)');
  });
});
