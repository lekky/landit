import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_MENU,
  ACCOUNT_MENU_ADMIN,
  MOBILE_NAV,
  PROGRESS_TABS,
  TOP_NAV,
  WHATS_ON_TABS,
  accountMenuFor,
  activeSection,
  isNavActive,
  type NavItem,
} from '@/components/shell/nav';

/**
 * The bottom bar's promise, checked.
 *
 * Under `src/lib/` rather than beside `components/shell/nav.ts` because that is
 * where `vitest.config.ts` looks, and its `include` is narrow on purpose — this
 * package does not unit-test screens. Nothing here renders one: `nav.ts` is
 * three arrays and a predicate.
 *
 * Below 861px `.nav` is `display: none`, so whatever `MOBILE_NAV` leaves out is
 * gone on a phone unless something else carries it. The bar used to be
 * `TOP_NAV.slice(0, 5)` and four destinations — Challenge, Events, Spots and
 * Plans — were reachable only from the site footer at the bottom of a scrolled
 * page. That is the defect these tests exist to stop coming back, and it came
 * back the moment somebody added a tenth destination without thinking about the
 * phone. So the assertion is not "the bar has five items"; it is "every
 * destination in the product has a way in on a phone".
 */

const phoneReachable = new Set<string>([
  ...MOBILE_NAV.map((item) => item.href),
  ...MOBILE_NAV.flatMap((item) => item.reaches ?? []),
  ...ACCOUNT_MENU.map((item) => item.href),
]);

describe('the phone carries every destination', () => {
  it.each(TOP_NAV.map((item) => [item.id, item.href] as const))(
    '%s (%s) is reachable below 861px',
    (_id, href) => {
      expect(phoneReachable.has(href)).toBe(true);
    },
  );

  it('spends exactly five cells, because .mobnav is repeat(5, 1fr)', () => {
    expect(MOBILE_NAV).toHaveLength(5);
  });

  it('claims nothing it does not honour: every `reaches` is a tab in its own drawer', () => {
    /*
     * A claim added without a way to follow it would pass the reachability test
     * above and still leave a rider stranded — that is the failure this catches.
     *
     * Checked against the *section's own* tabs rather than against a pooled set
     * of every tab in the app, which is what it used to do. Pooling them meant
     * What's on could have claimed `/stickers` and been marked honoured by the
     * Progress drawer, which no rider can reach from `/spots`.
     */
    for (const item of MOBILE_NAV) {
      const honoured = new Set<string>([
        ...(item.tabs ?? []).map((tab) => tab.href),
        // Home's is the dashboard's challenge card, not a drawer. `e2e` clicks it.
        ...(item.id === 'home' ? ['/challenge'] : []),
      ]);

      for (const href of item.reaches ?? []) {
        expect(honoured.has(href), `${item.id} claims ${href} with nothing to click`).toBe(true);
      }
    }
  });

  it('puts the two-screen sections behind a drawer that includes their own landing screen', () => {
    // A rider on `/events` needs a way back to `/spots`, not only forward.
    expect(WHATS_ON_TABS.map((t) => t.href)).toEqual(['/spots', '/events']);
    expect(PROGRESS_TABS.map((t) => t.href)).toEqual(['/progress', '/stickers']);
  });

  it('gives a drawer to exactly the sections that fold a second screen', () => {
    /*
     * The caret is drawn from `tabs`, so a section that reaches a screen without
     * carrying it would show no caret and open nothing — the invisible fold this
     * whole change exists to end. And a section with tabs but nothing folded
     * would put a caret on a cell that has nothing behind it.
     */
    const folded = MOBILE_NAV.filter((item) => item.id !== 'home' && item.reaches?.length);
    expect(folded.map((item) => item.id)).toEqual(['whats-on', 'progress']);

    for (const item of MOBILE_NAV) {
      const foldsSomething = item.id !== 'home' && Boolean(item.reaches?.length);
      expect(Boolean(item.tabs), `${item.id}`).toBe(foldsSomething);
    }
  });

  it("lists the section's own screen first, so arriving does not relabel the drawer", () => {
    // The drawer opens on arrival at `item.href`; if that screen were not the
    // first tab, a rider landing on Spots would meet a list headed by Events.
    for (const item of MOBILE_NAV) {
      if (!item.tabs) continue;
      expect(item.tabs.at(0)?.href, `${item.id}`).toBe(item.href);
    }
  });
});

describe('activeSection', () => {
  it('answers with the section a folded screen belongs to', () => {
    expect(activeSection('/events')?.id).toBe('whats-on');
    expect(activeSection('/spots')?.id).toBe('whats-on');
    expect(activeSection('/stickers')?.id).toBe('progress');
    expect(activeSection('/challenge')?.id).toBe('home');
  });

  it('holds the section across a sub-route, so a spot page does not close the drawer', () => {
    expect(activeSection('/spots/bay-sixty6')?.id).toBe('whats-on');
    expect(activeSection('/events/brighton-jam')?.id).toBe('whats-on');
  });

  it('answers with nothing on a screen that is in no section', () => {
    expect(activeSection('/account')).toBeUndefined();
    expect(activeSection('/report')).toBeUndefined();
    expect(activeSection('/plans')).toBeUndefined();
  });

  it('never answers with two sections for one screen', () => {
    // `MobileNav` takes the first match; two would mean the bar could light one
    // cell and open the other one's drawer beneath it.
    for (const path of [
      '/home',
      '/library',
      '/spots',
      '/events',
      '/progress',
      '/stickers',
      '/crew',
      '/challenge',
    ]) {
      expect(
        MOBILE_NAV.filter((item) => isNavActive(item, path)),
        path,
      ).toHaveLength(1);
    }
  });
});

describe('isNavActive', () => {
  const section = (id: string) => MOBILE_NAV.find((item) => item.id === id) as NavItem;

  it('lights the section a folded screen belongs to', () => {
    expect(isNavActive(section('whats-on'), '/events')).toBe(true);
    expect(isNavActive(section('progress'), '/stickers')).toBe(true);
    expect(isNavActive(section('home'), '/challenge')).toBe(true);
  });

  it('lights Crew on a rider profile and an invite, which sit under neither', () => {
    expect(isNavActive(section('crew'), '/riders/miles')).toBe(true);
    expect(isNavActive(section('crew'), '/join/ABC123')).toBe(true);
  });

  it('lights a section on its own sub-routes', () => {
    expect(isNavActive(section('library'), '/library/tailwhip')).toBe(true);
  });

  it('does not light a section on a screen it has nothing to do with', () => {
    expect(isNavActive(section('whats-on'), '/library')).toBe(false);
    expect(isNavActive(section('progress'), '/crew')).toBe(false);
    // A prefix match, not a string one: `/homework` is not `/home`.
    expect(isNavActive(section('home'), '/homework')).toBe(false);
  });

  it('leaves the bar blank on the account screens, which are not sections', () => {
    for (const item of MOBILE_NAV) {
      expect(isNavActive(item, '/account')).toBe(false);
      expect(isNavActive(item, '/report')).toBe(false);
    }
  });
});

describe('the top bar is untouched by the phone restructure', () => {
  it('still carries all nine, in the design order', () => {
    expect(TOP_NAV.map((item) => item.id)).toEqual([
      'home',
      'library',
      'progress',
      'stickers',
      'crew',
      'challenge',
      'events',
      'spots',
      'plans',
    ]);
  });
});

/**
 * The account menu's staff row.
 *
 * A display rule, and the tests say so: the gate is `requireStaff` in the
 * `/admin` layout and in every server action beneath it, and none of it is
 * reachable from here. What is worth pinning down is the half that is this
 * file's — that an ordinary rider is shown nothing at all about a portal, which
 * is the same answer the 404 gives, and that the five rider destinations are
 * not disturbed by a staff account seeing a sixth.
 */
describe('accountMenuFor', () => {
  it('gives an ordinary rider the five, and nothing that says a portal exists', () => {
    const menu = accountMenuFor(false);

    expect(menu.map((item) => item.id)).toEqual(['account', 'coach', 'plans', 'suggest', 'report']);
    expect(menu.some((item) => item.href.startsWith('/admin'))).toBe(false);
    expect(menu.some((item) => item.staff)).toBe(false);
  });

  it('treats an unknown role as not staff, so the flag has to be earned', () => {
    // `TopBarRider.staff` is optional, and a caller that forgets it must fail
    // closed rather than draw a link to a screen its rider cannot open.
    expect(accountMenuFor(undefined)).toEqual(ACCOUNT_MENU);
  });

  it('adds the portal last for staff, leaving the rider destinations in place', () => {
    const menu = accountMenuFor(true);

    expect(menu.map((item) => item.id)).toEqual([
      'account',
      'coach',
      'plans',
      'suggest',
      'report',
      'admin',
    ]);
    expect(menu.at(-1)).toBe(ACCOUNT_MENU_ADMIN);
    expect(menu.slice(0, 5)).toEqual([...ACCOUNT_MENU]);
  });

  it('keeps the two "tell us" routes adjacent, ideas before reports', () => {
    /*
     * Not decoration. `/suggest` exists because ideas filed as reports spend
     * the safeguarding rate limit, and the thing that stops a rider filing one
     * as the other is being able to see both at once. If a later edit separates
     * them, or puts the safeguarding route first in a menu most people open
     * looking for their account, this is the line that should argue about it.
     */
    const ids = ACCOUNT_MENU.map((item) => item.id);
    expect(ids.indexOf('report') - ids.indexOf('suggest')).toBe(1);
  });

  it('marks only the portal as staff, which is what draws it differently', () => {
    // `.accountmenu-item.staff` in `additions.css` — the violet row under the
    // heavier keyline. A rider destination picking that flag up would be
    // claiming a register it has no business in.
    expect(accountMenuFor(true).filter((item) => item.staff)).toEqual([ACCOUNT_MENU_ADMIN]);
    expect(ACCOUNT_MENU_ADMIN.href).toBe('/admin');
  });

  it('never mutates the shared list it builds from', () => {
    accountMenuFor(true);
    expect(ACCOUNT_MENU).toHaveLength(5);
  });
});
