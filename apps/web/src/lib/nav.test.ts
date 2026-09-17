import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_MENU,
  ACCOUNT_MENU_ADMIN,
  BELL_DESTINATION,
  DESTINATIONS,
  MOBILE_NAV,
  NAV_GROUPS,
  TOP_NAV,
  accountMenuFor,
  isNavActive,
  mobileNavFor,
  navFor,
  topNavFor,
  type NavItem,
} from '@/components/shell/nav';

/**
 * The bars' promise, checked.
 *
 * Under `src/lib/` rather than beside `components/shell/nav.ts` because that is
 * where `vitest.config.ts` looks, and its `include` is narrow on purpose — this
 * package does not unit-test screens. Nothing here renders one: `nav.ts` is a
 * few arrays and a predicate.
 *
 * Below 861px `.nav` is `display: none`, so whatever the bottom bar leaves out
 * is gone on a phone unless something else carries it. The bar was once
 * `TOP_NAV.slice(0, 5)` and four destinations — Challenge, Events, Spots and
 * Plans — were reachable only from the site footer at the bottom of a scrolled
 * page. That is the defect these tests exist to stop coming back, and it came
 * back the moment somebody added a tenth destination without thinking about the
 * phone.
 *
 * The app shell rethink makes both bars the same four groups, which kills the
 * old form of the check: "every top-bar entry is on the phone" is trivially
 * true when the two lists are one object. So the question is asked of the
 * product instead — `DESTINATIONS` is everywhere a rider can go, written out by
 * hand, and every one of them has to be a group, something a group reaches, an
 * account-menu row or the bell.
 */

/** Everywhere the shell can take a rider, at any width. */
const reachable = (sessionsEnabled?: boolean) =>
  new Set<string>([
    ...navFor(sessionsEnabled).map((item) => item.href),
    ...navFor(sessionsEnabled).flatMap((item) => item.reaches ?? []),
    ...ACCOUNT_MENU.map((item) => item.href),
    // The account's own screens (rethink §3.9, T51): the menu's row is the way
    // into the list, and the list is the way into these six.
    ...ACCOUNT_MENU.flatMap((item) => item.reaches ?? []),
    BELL_DESTINATION,
  ]);

describe('every destination has a way in', () => {
  it.each(
    DESTINATIONS.filter((href) => href !== '/progress/sessions').map((href) => [href] as const),
  )('%s is reachable on a phone', (href) => {
    expect(reachable().has(href)).toBe(true);
  });

  it('reaches Sessions for a rider the preview covers, and only for them', () => {
    // A cell that offered a screen the rider would be refused is worse than a
    // cell that does not mention it: the gate is `sessionsEnabledFor` on every
    // `/progress/sessions` route, and this is the bar agreeing with it.
    expect(reachable(true).has('/progress/sessions')).toBe(true);
    expect(reachable(false).has('/progress/sessions')).toBe(false);
  });

  it('spends four groups, in the order both bars draw them (D1, D8)', () => {
    expect(NAV_GROUPS.map((item) => item.id)).toEqual(['home', 'library', 'find', 'crew']);
  });

  it('draws the same four at both widths, which is the whole change', () => {
    // D8: a desktop that grouped its nav differently from the phone would be
    // two products to learn. `MobileNav` is what inserts LOG between the second
    // and third of these; the list itself has no entry for it, because it is
    // not a destination.
    expect(TOP_NAV).toBe(NAV_GROUPS);
    expect(MOBILE_NAV).toBe(NAV_GROUPS);
    expect(topNavFor(true)).toEqual(mobileNavFor(true));
  });

  it('claims nothing twice: no two groups reach the same screen', () => {
    // Two groups claiming one screen would mean the bar could light either
    // cell, and `isNavActive` would answer differently depending on order.
    const claims = NAV_GROUPS.flatMap((item) => [item.href, ...(item.reaches ?? [])]);
    expect(new Set(claims).size).toBe(claims.length);
  });

  it('leaves the bar exactly as it was for a rider outside the preview', () => {
    expect(navFor(false)).toBe(NAV_GROUPS);
    expect(navFor(undefined)).toBe(NAV_GROUPS);
  });

  it('holds Home lit on all four record screens for a rider with sessions', () => {
    const home = navFor(true).find((item) => item.id === 'home') as NavItem;
    for (const path of ['/progress', '/progress/sessions', '/stickers', '/challenge']) {
      expect(isNavActive(home, path), path).toBe(true);
    }
  });
});

describe('which cell stays lit (§2.2)', () => {
  const group = (id: string) => NAV_GROUPS.find((item) => item.id === id) as NavItem;
  const lit = (pathname: string) => NAV_GROUPS.filter((item) => isNavActive(item, pathname));

  it('lights Home on the record screens it holds', () => {
    expect(lit('/progress').map((item) => item.id)).toEqual(['home']);
    expect(lit('/stickers').map((item) => item.id)).toEqual(['home']);
    expect(lit('/challenge').map((item) => item.id)).toEqual(['home']);
  });

  it('lights Find on the screens it holds, and on their sub-routes', () => {
    for (const path of [
      '/find',
      '/spots',
      '/spots/bay-sixty6',
      '/events',
      '/events/brighton-jam',
      '/events/past',
      '/events/mine',
    ]) {
      expect(
        lit(path).map((item) => item.id),
        path,
      ).toEqual(['find']);
    }
  });

  it('lights Tricks on a trick page and on the glossary', () => {
    expect(isNavActive(group('library'), '/library/tailwhip')).toBe(true);
    expect(isNavActive(group('library'), '/glossary')).toBe(true);
  });

  it('lights Crew on a rider profile and an invite, which sit under neither', () => {
    expect(isNavActive(group('crew'), '/riders/miles')).toBe(true);
    expect(isNavActive(group('crew'), '/join/ABC123')).toBe(true);
  });

  it('never lights two cells for one screen', () => {
    for (const path of DESTINATIONS) expect(lit(path).length, path).toBeLessThanOrEqual(1);
  });

  it('lights nothing on the screens that belong to no group', () => {
    // `/whats-new` included: the bell is on every screen, so a rider reading
    // their own news is not "in" a group.
    for (const path of ['/account', '/plans', '/coach', '/suggest', '/report', '/whats-new']) {
      expect(
        lit(path).map((item) => item.id),
        path,
      ).toEqual([]);
    }
  });

  it('matches on path segments, not on strings', () => {
    expect(isNavActive(group('home'), '/homework')).toBe(false);
    expect(isNavActive(group('find'), '/spotsomething')).toBe(false);
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
