import type { Route } from 'next';

import { ROUTES } from '@/lib/routes';

/**
 * The portal's tabs — the prototype's nine (`landit-admin.jsx`, `A_TABS`) in
 * its order, plus Moderation.
 *
 * Two are T16's and the rest are T17's. The `href?` shape stayed after T17
 * filled every entry in, because it is the thing that made the handover safe:
 * a tab whose screen does not exist renders as a label rather than a dead link
 * (LESSONS §3a), and `typedRoutes` refuses to compile the alternative anyway.
 * The next tab somebody adds gets the same one-line handover — path into
 * `ROUTES`, entry below.
 *
 * **Moderation is the tenth, and it is not the prototype's.** `landit-admin.jsx`
 * predates the `reports` collection entirely; the queue over it is plan §7's
 * ask, so it goes at the end rather than inside the nine, where its absence
 * from the design pack would read as a transcription error.
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
  { id: 'tricks', label: 'Trick library', href: ROUTES.adminTricks },
  { id: 'stickers', label: 'Stickers', href: ROUTES.adminStickers },
  { id: 'spots', label: 'Spots', href: ROUTES.adminSpots },
  { id: 'events', label: 'Events', href: ROUTES.adminEvents },
  { id: 'challenges', label: 'Challenges', href: ROUTES.adminChallenges },
  { id: 'notices', label: 'Announcements', href: ROUTES.adminNotices },
  { id: 'plans', label: 'Plans', href: ROUTES.adminPlans },
  { id: 'moderation', label: 'Moderation', href: ROUTES.adminModeration },
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
