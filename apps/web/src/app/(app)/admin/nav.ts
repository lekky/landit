import type { Route } from 'next';

import { ROUTES } from '@/lib/routes';

/**
 * The portal's sections, in three named groups.
 *
 * **Why they are grouped** (Rachid, 2026-09-14, in chat, choosing option A from
 * the mockups). Twelve sections and the current section's filters used to sit
 * in two rows of the same `.pill`, stacked, with nothing between them saying
 * one navigates and the other narrows — six wrapping rows on a phone before any
 * work appeared. Grouping is what makes the list explain itself: "Waiting on
 * you" says what a queue is without a tooltip, and a drawer collapses the whole
 * thing to one row until it is wanted.
 *
 * **Riders & money leads** (same conversation). It carries Overview, which is
 * `/admin` itself, so the group order and the landing page agree.
 *
 * The nine content tabs are still the prototype's (`landit-admin.jsx`,
 * `A_TABS`); Moderation, Ideas and Video checks are not, and the notes on each
 * below say where they came from. Grouping changed their order, not their
 * provenance.
 *
 * The `href?` shape stayed after T17 filled every entry in, because it is the
 * thing that made the handover safe: a tab whose screen does not exist renders
 * as a label rather than a dead link (LESSONS §3a), and `typedRoutes` refuses
 * to compile the alternative anyway. The next tab somebody adds gets the same
 * one-line handover — path into `ROUTES`, entry into whichever group owns it.
 */

/**
 * A queue whose depth is worth carrying on the nav.
 *
 * Only three, and each names a pile of things riders sent that a person has to
 * work through. **Video checks is deliberately not one of them**: it is a job's
 * history rather than a queue, so a badge there would be a number nobody has to
 * act on — and a badge that never means "do something" teaches staff to ignore
 * the ones that do.
 */
export type AdminQueueKey = 'reports' | 'spots' | 'suggestions';

export type AdminTab = {
  readonly id: string;
  readonly label: string;
  /** Absent until the task that owns this tab lands its screen. */
  readonly href?: Route;
  /** Set where the nav should show how much is waiting. */
  readonly queue?: AdminQueueKey;
};

export type AdminGroup = {
  readonly id: string;
  /**
   * Read by staff, so it says what the group is *for* rather than what the
   * records are. "Waiting on you" is a job; "Reports and suggestions" is a
   * schema.
   */
  readonly label: string;
  readonly tabs: readonly AdminTab[];
};

export const ADMIN_GROUPS: readonly AdminGroup[] = [
  {
    id: 'riders',
    label: 'Riders & money',
    tabs: [
      { id: 'overview', label: 'Overview', href: ROUTES.admin },
      { id: 'riders', label: 'Riders', href: ROUTES.adminRiders },
      { id: 'plans', label: 'Plans', href: ROUTES.adminPlans },
    ],
  },
  {
    id: 'queues',
    label: 'Waiting on you',
    tabs: [
      /*
       * The tenth tab, and not the prototype's: `landit-admin.jsx` predates the
       * `reports` collection entirely, and the queue over it is plan §7's ask.
       */
      { id: 'moderation', label: 'Moderation', href: ROUTES.adminModeration, queue: 'reports' },
      { id: 'spots', label: 'Spots', href: ROUTES.adminSpots, queue: 'spots' },
      /*
       * The eleventh, and the second that is not the prototype's; it arrived
       * with `/suggest` (2026-09-12). It sits beside Moderation because the two
       * are a pair — both are piles of things riders sent us, and staff working
       * through one will want the other. They stay two tabs over two collections
       * for the reason `/suggest` exists at all: a shared rate limit would let
       * ideas crowd out safeguarding reports.
       */
      { id: 'suggestions', label: 'Ideas', href: ROUTES.adminSuggestions, queue: 'suggestions' },
      /*
       * The twelfth, and the one in this group that is nobody's queue — which is
       * why it carries no `queue` key. It is here rather than under content
       * because it is checked the same way the queues are (has anything gone
       * wrong since yesterday), and it sits last because the nightly tutorial
       * check looks after itself.
       */
      { id: 'video-checks', label: 'Video checks', href: ROUTES.adminVideoChecks },
    ],
  },
  {
    id: 'content',
    label: 'What the app shows',
    tabs: [
      { id: 'tricks', label: 'Trick library', href: ROUTES.adminTricks },
      { id: 'challenges', label: 'Challenges', href: ROUTES.adminChallenges },
      { id: 'events', label: 'Events', href: ROUTES.adminEvents },
      { id: 'notices', label: 'Announcements', href: ROUTES.adminNotices },
      { id: 'stickers', label: 'Stickers', href: ROUTES.adminStickers },
    ],
  },
];

/**
 * Every tab, flat and in drawer order.
 *
 * Derived rather than maintained beside `ADMIN_GROUPS`, so a tab cannot be
 * added to one and forgotten in the other.
 */
export const ADMIN_TABS: readonly AdminTab[] = ADMIN_GROUPS.flatMap((group) => group.tabs);

/**
 * Which tab owns the highlight.
 *
 * Overview is `/admin` exactly. Every other tab owns its own subtree, so a
 * rider sheet at `/admin/riders/{id}` keeps Riders lit rather than blanking the
 * drawer — the same prefix rule as `isNavActive`, minus the `alsoActiveFor`
 * escape hatch, because no admin screen lives outside its own tab's path.
 */
export function isAdminTabActive(tab: AdminTab, pathname: string): boolean {
  if (!tab.href) return false;
  if (tab.href === ROUTES.admin) return pathname === ROUTES.admin;
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

/**
 * The tab the current URL is on, or `undefined` on a path no tab claims.
 *
 * The drawer button names this, so it is the one piece of state the closed
 * drawer shows. Longest `href` first: `/admin` is a prefix of nothing (it is
 * matched exactly above) but this keeps the rule honest if a nested tab is ever
 * added under another tab's path.
 */
export function activeAdminTab(pathname: string): AdminTab | undefined {
  return [...ADMIN_TABS]
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))
    .find((tab) => isAdminTabActive(tab, pathname));
}
