import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_MENU,
  MOBILE_NAV,
  PROGRESS_TABS,
  TOP_NAV,
  WHATS_ON_TABS,
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

  it('claims nothing it does not honour: every `reaches` is a real tab or card', () => {
    // The three claims, and the three mechanisms that keep them. A claim added
    // without a way to follow it would pass the reachability test above and
    // leave a rider stranded, which is the failure this catches.
    const honoured = new Set<string>([
      ...WHATS_ON_TABS.map((tab) => tab.href),
      ...PROGRESS_TABS.map((tab) => tab.href),
      // `HomeScreen`'s challenge card. Asserted for real by `e2e/shell.spec.ts`,
      // which clicks it.
      '/challenge',
    ]);

    for (const item of MOBILE_NAV) {
      for (const href of item.reaches ?? []) {
        expect(honoured.has(href), `${item.id} claims ${href} with nothing to click`).toBe(true);
      }
    }
  });

  it('puts the two-screen sections behind a tab row that includes their own landing screen', () => {
    // A rider on `/events` needs a way back to `/spots`, not only forward.
    expect(WHATS_ON_TABS.map((t) => t.href)).toEqual(['/spots', '/events']);
    expect(PROGRESS_TABS.map((t) => t.href)).toEqual(['/progress', '/stickers']);
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
