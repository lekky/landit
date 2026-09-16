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

/** `#ff5a1f` as `rgb(255, 90, 31)`, which is how a browser reports a colour. */
function hexToRgb(hex: string): string {
  const value = hex.trim().replace('#', '');
  const n = parseInt(value, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

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
   *
   * **375 and 960 and 1280 were added by the app shell rethink (T45).** The bar
   * changed shape at both ends: the nav went from nine items to four, and the
   * right-hand end went from a streak chip and an avatar to a sport chip, a Log
   * button, a bell and an avatar. Four items is far more room than nine, but
   * the right-hand group is wider than it was, and 960 is the width the spec
   * measured the four-item nav against on the canvas. 375 is the phone, where
   * `.nav` is hidden and the right-hand group is the whole test.
   */
  await page.goto(SHELL);

  // Read through locators rather than `page.evaluate`: this project's e2e
  // tsconfig has no DOM lib, so `document` and `HTMLElement` are not names here.
  // An element handed to `locator.evaluate` is typed by Playwright itself, and
  // `scrollWidth` / `clientWidth` come with it.
  const root = page.locator('html');

  for (const width of [375, 861, 900, 934, 960, 1040, 1041, 1280, 1440]) {
    await page.setViewportSize({ width, height: 800 });

    await expect
      .poll(() => root.evaluate((el) => el.scrollWidth - el.clientWidth), {
        message: `the document scrolls sideways at ${width}px`,
      })
      .toBe(0);

    // Below 861px `.nav` is `display: none` and `MobileNav` has the job, so the
    // three checks below are about the widths where the nav is actually drawn.
    if (width < 861) continue;

    const nav = page.getByRole('navigation', { name: 'Main', exact: true });

    /*
     * And the nav does not quietly swallow the overflow either.
     *
     * `.nav` carries `min-width: 0` and its own `overflow-x` as a safety net, so
     * the check above passes on that alone — it did, with the tightening
     * removed, which is exactly what a net is for and exactly why it cannot be
     * the whole assertion. This is the half that proves the items really fit: a
     * nav that scrolls has items nobody can see, and Playwright counts one
     * scrolled out of view as visible.
     */
    await expect
      .poll(() => nav.evaluate((el) => el.scrollWidth - el.clientWidth), {
        message: `the nav itself scrolls at ${width}px, so an item is out of view`,
      })
      .toBe(0);

    // Fitting by dropping items would pass both checks and fail the point of
    // them: all four groups stay on show, only closer together.
    await expect(nav.locator('> *'), `four nav groups at ${width}px`).toHaveCount(4);
  }
});

test('the bottom bar is four groups and a LOG cell, in the order D1 sets', async ({ page }) => {
  /*
   * Five cells, because `.mobnav` is `repeat(5, 1fr)` and the design specifies
   * five (handoff, Responsive) — but the middle one is not a destination.
   *
   * **Home · Tricks · LOG · Find · Crew** (D1, Rachid, 2026-09-15, in chat,
   * choosing shape A from three). The bar used to be five *sections*, two of
   * which folded a second screen behind a drawer; before that it was the first
   * five entries of a nine-item top bar, which left Challenge, Events, Spots
   * and Plans with no navigation entry at all below 861px. That is the defect
   * this test exists to stop coming back, and the four groups plus the account
   * menu are what answers it now — `apps/web/src/lib/nav.test.ts` is where the
   * whole promise is checked, destination by destination.
   */
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto(SHELL);

  const bar = page.getByRole('navigation', { name: 'Main, compact', exact: true });

  // Five cells: four links and the LOG button, which goes nowhere.
  await expect(bar.locator('> *')).toHaveCount(5);

  const links = bar.locator('> a');
  await expect(links).toHaveCount(4);
  await expect(links).toHaveText([/Home/, /Tricks/, /Find/, /Crew/]);

  for (const [name, href] of [
    ['Home', '/home'],
    ['Tricks', '/library'],
    // `/find` redirects to `/spots` until T48 builds the summary. The cell
    // points at the group's own address either way, so nothing has to change
    // in the bar when the page arrives.
    ['Find', '/find'],
    ['Crew', '/crew'],
  ] as const) {
    await expect(bar.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  }

  // LOG is the third cell, and it is a button: it opens a sheet rather than
  // going anywhere, which is why it has no `href` to check.
  const log = bar.getByRole('button', { name: 'Log something' });
  await expect(log).toBeVisible();
  await expect(log).toHaveAttribute('aria-expanded', 'false');

  const order = await bar
    .locator('> *')
    .evaluateAll((nodes) => nodes.map((n) => n.tagName.toLowerCase()));
  expect(order, 'LOG is not the middle cell').toEqual(['a', 'a', 'button', 'a', 'a']);
});

test('the LOG cell opens the sheet, and Escape closes it', async ({ page }) => {
  /*
   * The one front door onto logging (D3). Four ways of recording a ride were in
   * four different places — the streak card, a trick page's stage picker, the
   * session form behind Progress, and the clip field further down a trick page
   * — and a rider had to know which screen held which.
   *
   * "Log a session" is drawn only for a rider the preview covers (T41), and
   * `/design/shell` renders `AppShell` with no gate at all, so what it shows is
   * the sessions-off shape: three rows, not four.
   */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SHELL);

  const log = page
    .getByRole('navigation', { name: 'Main, compact', exact: true })
    .getByRole('button', { name: 'Log something' });
  await log.click();

  const sheet = page.getByRole('dialog', { name: 'Log something' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: /I rode today/ })).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Log a trick/ })).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Add a clip link/ })).toBeVisible();
  // The plus reads as a cross while the sheet is up, which is the cell saying
  // it will close what it opened.
  await expect(
    page
      .getByRole('navigation', { name: 'Main, compact', exact: true })
      .getByRole('button', { name: 'Close the log sheet' }),
  ).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});

test('the sport chip is the switcher, and the bar takes the sport colour', async ({ page }) => {
  /*
   * D5: the sport is chosen once, in the top bar, and the bar's bottom rule
   * carries the answer. Six screens used to ask the same question with their
   * own tab row, all writing to the same global state and none of them saying
   * so. The rows go screen by screen through T46 and T50; the chip is here.
   */
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(SHELL);

  const chip = page.getByRole('button', { name: /^Riding: .+\. Switch sport\.$/ });
  await expect(chip).toBeVisible();

  /*
   * The rule is a custom property set on `.topbar` from `useSport()`, which
   * `additions.css` reads with the old ink as its fallback. So the inline
   * property is what says the component decided, and `toHaveCSS` below is what
   * says the stylesheet acted on it — the first alone would pass on a variable
   * nothing read, and the second alone cannot tell a colour change from a
   * repaint.
   */
  const rule = () =>
    page.locator('.topbar').evaluate((el) => el.style.getPropertyValue('--sport-rule'));
  const ruleBefore = await rule();
  expect(ruleBefore, 'the top bar sets no sport colour at all').not.toBe('');
  await expect(page.locator('.topbar')).toHaveCSS('border-bottom-color', hexToRgb(ruleBefore));

  await chip.click();
  const menu = page.getByRole('group', { name: 'Switch sport' });
  await expect(menu).toBeVisible();
  // One row per sport the rider tracks. `/design/shell` passes no `sports`, so
  // the provider offers every sport there is.
  await expect(menu.getByRole('button')).toHaveCount(SPORT_IDS.length);

  await menu.getByRole('button').nth(1).click();
  await expect(menu).toBeHidden();

  // The rule under the bar changed with the chip, in both places.
  await expect.poll(rule).not.toBe(ruleBefore);
  await expect(page.locator('.topbar')).toHaveCSS('border-bottom-color', hexToRgb(await rule()));
});

test('the bell is a link on a phone and a panel on a desktop', async ({ page }) => {
  // D4. T45 builds the button and the slot its count sits in; T47 builds what
  // is behind it, so there is no badge yet and the panel says so in a line.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SHELL);
  await expect(page.getByRole('link', { name: "What's new" })).toHaveAttribute(
    'href',
    '/whats-new',
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: "What's new" }).click();
  await expect(page.getByRole('group', { name: "What's new" })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: "What's new" })).toBeHidden();
});

test('no bottom-bar label wraps, down to the narrowest phone anyone still uses', async ({
  page,
}) => {
  /*
   * A wrapped label takes the row's height with it and pushes the icons out of
   * line. "What's on" was the longest of the old five and the one that made
   * this worth measuring rather than eyeballing: about 58px of Barlow Condensed
   * against a 71px cell at 375px, and about 60px of cell at 320px. The four
   * labels the rethink leaves — Home, Tricks, Find, Crew — are all shorter, so
   * this has gone from a squeeze to a net. It stays a net: the numbers the
   * arithmetic predicts are the numbers in the font that loaded, and a fallback
   * font is exactly the case it is here for.
   */
  for (const width of [430, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(SHELL);

    // `> a`, so the four link cells are compared with each other. The LOG cell
    // is deliberately not one of them: its 58px square is raised 30px above the
    // bar, so its box is taller by design and averaging it in would turn the
    // design into a failure.
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

test('the avatar opens the five destinations that are not places to ride', async ({ page }) => {
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
    // The two "tell us something" routes, adjacent and in this order. Ideas
    // first: a rider unsure which of the two they want should see both, and the
    // cheerful one comes before the safeguarding one in a menu most people open
    // looking for their account.
    ['Tell us an idea', '/suggest'],
    // Footer-only before this, underneath a scrolled page. The OSA codes ask
    // for a reporting route that is easy to find (plan §6.1).
    ['Report something', '/report'],
  ] as const) {
    await expect(menu.getByRole('menuitem', { name, exact: true })).toHaveAttribute('href', href);
  }

  // And nothing about a staff portal, which is the visible half of the 404 an
  // ordinary rider meets at `/admin` (`lib/staff.ts`): no disabled row, no
  // greyed label, no mention. Six rows, not five: the sixth is Sign out, which
  // is not a destination and has its own test below.
  await expect(menu.getByRole('menuitem')).toHaveCount(6);
  await expect(menu.locator('a[role="menuitem"]')).toHaveCount(5);
  await expect(menu.getByRole('menuitem', { name: 'Admin portal' })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('a staff account gets a sixth item, the admin portal, drawn as staff', async ({ page }) => {
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
  await expect(items).toHaveCount(7);

  // Last of the *destinations* — Sign out sits below it and is not one.
  const links = menu.locator('a[role="menuitem"]');
  const admin = menu.getByRole('menuitem', { name: 'Admin portal', exact: true });
  await expect(admin).toHaveAttribute('href', '/admin');
  await expect(links).toHaveCount(6);
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

test('every nav group is a real link, at both widths', async ({ page }) => {
  await page.goto(SHELL);

  // The nav's half of `landing.spec.ts`'s "a built screen is a real link".
  // Wave 5's four sessions each shipped a screen reachable by URL and left
  // `components/shell/nav.ts` alone, so that four concurrent rebases could not
  // drop a sibling's line from the one file that decides whether a screen has a
  // way in. That is still what this guards; the list is four now rather than
  // nine, and the five screens that lost a cell are reached from Home, the
  // library and the avatar instead (`apps/web/src/lib/nav.test.ts`).
  const nav = page.getByRole('navigation', { name: 'Main', exact: true });
  for (const [name, href] of [
    ['Home', '/home'],
    ['Tricks', '/library'],
    // A redirect to `/spots` until T48, which is a screen existing rather than
    // a label standing in for one: the cell points at the group and stays put
    // when the summary lands.
    ['Find', '/find'],
    ['Crew', '/crew'],
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
