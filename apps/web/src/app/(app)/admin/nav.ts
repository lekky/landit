import type { Route } from 'next';

import { ROUTES } from '@/lib/routes';

/**
 * The portal's nine tabs, in the prototype's order (`landit-admin.jsx`,
 * `A_TABS`).
 *
 * Two of them are T16's and seven are T17's, and the ones that do not exist yet
 * render as labels rather than links — the same rule `lib/routes.ts` and
 * `components/shell/nav.ts` follow, for the same reason (LESSONS §3a): a nav
 * where two thirds of the items 404 is worse than one that admits what has not
 * been built. `typedRoutes` would refuse to compile the alternative anyway.
 *
 * T17's handover is one line each: add the path to `ROUTES`, put it on the
 * matching entry below.
 */
export type AdminTab = {
  readonly id: string;
  readonly label: string;
  /** Absent until the task that owns this tab lands its screen. */
  readonly href?: Route;
};

export const ADMIN_TABS: readonly AdminTab[] = [
  { id: 'overview', label: 'Overview', href: ROUTES.admin },
  { id: 'riders', label: 'Riders', href: ROUTES.adminRiders },
  { id: 'tricks', label: 'Trick library' },
  { id: 'stickers', label: 'Stickers' },
  { id: 'spots', label: 'Spots' },
  { id: 'events', label: 'Events' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'notices', label: 'Announcements' },
  { id: 'plans', label: 'Plans' },
];

/**
 * Which tab owns the highlight.
 *
 * Overview is `/admin` exactly. Every other tab owns its own subtree, so a
 * rider sheet at `/admin/riders/{id}` keeps Riders lit rather than blanking the
 * row — the same prefix rule as `isNavActive`, minus the `alsoActiveFor`
 * escape hatch, because no admin screen lives outside its own tab's path.
 */
export function isAdminTabActive(tab: AdminTab, pathname: string): boolean {
  if (!tab.href) return false;
  if (tab.href === ROUTES.admin) return pathname === ROUTES.admin;
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}
