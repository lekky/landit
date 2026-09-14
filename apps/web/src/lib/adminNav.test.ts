import { describe, expect, it } from 'vitest';

import { ADMIN_GROUPS, ADMIN_TABS, activeAdminTab, isAdminTabActive } from '@/app/(app)/admin/nav';

import { ROUTES } from '@/lib/routes';

/**
 * The staff portal's grouped nav, checked.
 *
 * Under `src/lib/` rather than beside `admin/nav.ts` because that is where
 * `vitest.config.ts` looks. Nothing here renders a screen: `nav.ts` is three
 * arrays and two predicates.
 *
 * The drawer replaced a flat row of twelve pills (Rachid, 2026-09-14, in chat).
 * The whole point of grouping is that every section still has exactly one home
 * — a tab that slips out of `ADMIN_GROUPS` during a later edit is a screen
 * staff can no longer reach from anywhere, and it would look like nothing more
 * than a slightly shorter list. That is the defect these tests exist to stop.
 */
describe('the admin groups', () => {
  it('carry every section exactly once', () => {
    const ids = ADMIN_GROUPS.flatMap((group) => group.tabs.map((tab) => tab.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(ADMIN_TABS.map((tab) => tab.id));
  });

  it('reach all twelve screens', () => {
    // Every admin route in `ROUTES` has a tab; a screen nobody links to is a
    // screen nobody finds. Counted from `ROUTES` rather than written as `12`,
    // so adding a route and forgetting the tab fails here rather than shipping.
    const adminRoutes = Object.entries(ROUTES)
      .filter(([key]) => key === 'admin' || key.startsWith('admin'))
      .map(([, path]) => path);

    const hrefs = ADMIN_TABS.map((tab) => tab.href);
    for (const route of adminRoutes) expect(hrefs).toContain(route);
    expect(adminRoutes).toHaveLength(12);
  });

  it('lead with riders and money, so the first tab is the portal itself', () => {
    // Rachid's call, 2026-09-14. Overview is `/admin`, so group order and the
    // landing page have to agree or the drawer opens on a section that is not
    // the one being shown.
    expect(ADMIN_GROUPS[0]?.id).toBe('riders');
    expect(ADMIN_TABS[0]?.href).toBe(ROUTES.admin);
  });

  it('badge only the queues a person has to work through', () => {
    const badged = ADMIN_TABS.filter((tab) => tab.queue).map((tab) => tab.id);
    // Video checks is a job's history, not a queue. A badge that never means
    // "do something" teaches staff to ignore the ones that do.
    expect(badged).toEqual(['moderation', 'spots', 'suggestions']);
  });
});

describe('which tab is lit', () => {
  it('gives Overview only its own path', () => {
    const overview = ADMIN_TABS.find((tab) => tab.id === 'overview')!;
    expect(isAdminTabActive(overview, ROUTES.admin)).toBe(true);
    expect(isAdminTabActive(overview, ROUTES.adminRiders)).toBe(false);
  });

  it('keeps a tab lit on its own subtree', () => {
    // A rider sheet at `/admin/riders/{id}` must not blank the drawer.
    expect(activeAdminTab('/admin/riders/abc123')?.id).toBe('riders');
    expect(activeAdminTab(ROUTES.adminVideoChecks)?.id).toBe('video-checks');
  });

  it('names nothing on a path no tab claims', () => {
    expect(activeAdminTab('/dashboard')).toBeUndefined();
  });
});
