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
 * **Moderation is the tenth and Ideas the eleventh, and neither is the
 * prototype's.** `landit-admin.jsx` predates the `reports` collection entirely
 * and the `suggestions` one by a year; the queue over the first is plan §7's
 * ask and the second arrived with `/suggest` (2026-09-12). Both go at the end
 * rather than inside the nine, where their absence from the design pack would
 * read as a transcription error.
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
  /*
   * The eleventh, and the second that is not the prototype's. It sits after
   * Moderation rather than beside the content tabs because the two are a pair:
   * both are queues of things riders sent us, and staff working through one
   * will want the other. They stay two tabs over two collections for the reason
   * `/suggest` exists at all — a shared rate limit would let ideas crowd out
   * safeguarding reports.
   */
  { id: 'suggestions', label: 'Ideas', href: ROUTES.adminSuggestions },
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
