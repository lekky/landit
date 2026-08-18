import type { Route } from 'next';

import type { LegalDocId } from '@/content/legal';

/**
 * Which destinations exist, and which do not yet.
 *
 * `typedRoutes` is on (`next.config.ts`), so a `Link` to a page nobody has
 * built is a compile error rather than a 404 discovered by a rider. That turns
 * "the nav lists screens from later waves" into a real design question, and the
 * answer used throughout T5 is: **a target with no `href` renders as a label,
 * not a link.** It keeps its place and its styling, loses its underline and its
 * focus stop, and is announced as unavailable.
 *
 * When your task lands a screen, add its path here and to the nav item that
 * points at it. That is the whole handover — one line, and the navigation, the
 * footer and the landing page start linking to you.
 *
 * T6 added the auth routes and deleted `AUTH_ROUTES_LIVE`, the constant that
 * kept the landing page's calls to action disabled while `/signup` did not
 * exist.
 */
export const ROUTES = {
  /** The signed-out landing page. The rider's dashboard is `dashboard`. */
  home: '/',
  /**
   * The signed-in dashboard (T8).
   *
   * A route of its own rather than `/`, because `/` is the marketing landing
   * page and stays one: a rider arriving from a shared link should see what
   * everybody else sees, and the two pages have nothing in common but a name.
   */
  dashboard: '/home',
  signUp: '/signup',
  signIn: '/signin',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  onboarding: '/onboarding',
  account: '/account',
  library: '/library',
  progress: '/progress',
  /**
   * T12's two screens. Reachable by URL from the moment they merge; the nav
   * entries that point at them are wired separately, once every Wave 5 screen
   * exists, so four concurrent sessions do not all edit `components/shell/nav.ts`.
   */
  challenge: '/challenge',
  events: '/events',
  /** T10's sticker wall. Same rule as above: the nav entry is wired separately. */
  stickers: '/stickers',
  crew: '/crew',
  coach: '/coach',
  /** T13's spots and map, on the same terms. */
  spots: '/spots',
  /**
   * Telling us something is wrong (T18).
   *
   * **Reachable signed out, deliberately.** The OSA's Protection of Children
   * Codes want a reporting route that works for somebody who is not a
   * signed-up rider — a parent who has been shown a screenshot, a park owner,
   * a teacher — and a route behind a sign-in wall is not that (plan §6.1,
   * §6.5). It sits inside the `(app)` group because it wants the shell, not
   * because it wants a session; `/plans` is signed-out for the same reason.
   */
  report: '/report',
  /**
   * Membership (T15). The one screen in the app group that reads signed out:
   * the site footer links it, and a person deciding whether to sign up should
   * not have to sign up to find out what it costs.
   */
  plans: '/plans',
  /**
   * The staff portal (T16), and the one route here that is not for riders.
   *
   * Deliberately **not** wired into `components/shell/nav.ts`. Partly for the
   * reason that file records — Wave 6 runs two concurrent sessions and one
   * shared array is one rebase conflict in the file that decides whether a
   * screen is reachable — and partly because a staff entry in the rider nav is
   * a design question nobody has answered: the prototype's app had no routes,
   * so it could show the tab to everyone and let the gate refuse. A real bar
   * would have to render conditionally on `role`, on every page, for a link
   * two people use.
   *
   * So the portal is reached by typing the address, which is what the plan's
   * "role gate" implies and what staff will do anyway. The nav entry, if it is
   * wanted, is a wave-6 wiring chore alongside T15's `plans` line.
   */
  admin: '/admin',
  adminRiders: '/admin/riders',
  /**
   * T17's content tabs, one path each, in `admin/nav.ts`'s order.
   *
   * Entries here rather than one array of tabs for the reason the head of this
   * file gives: a lost line in `ROUTES` is a compile error, and a lost line in
   * a tab array is a screen with no way in that nothing notices (LESSONS §1).
   * `moderation` is the one that has no prototype tab behind it — the reports
   * queue is plan §7's, not `landit-admin.jsx`'s.
   */
  adminTricks: '/admin/tricks',
  adminStickers: '/admin/stickers',
  adminSpots: '/admin/spots',
  adminEvents: '/admin/events',
  adminChallenges: '/admin/challenges',
  adminNotices: '/admin/notices',
  adminPlans: '/admin/plans',
  adminModeration: '/admin/moderation',
} as const satisfies Record<string, Route>;

export const legalHref = (doc: LegalDocId): Route => `/legal/${doc}`;

/**
 * The library, optionally showing only the tricks the rider is tracking (T22).
 *
 * "My tricks" is a query parameter rather than a route of its own, and that is
 * the decision rather than a shortcut. It is the same list of the same cards
 * with the same sidebar filters still applying — a second route would be a
 * second copy of the library that has to be kept in step with the first. What a
 * rider gets from it is what a route would have given them anyway: an address.
 * `/library?mine=1` can be bookmarked, linked from the dashboard, and shared
 * between a rider's own devices.
 *
 * Absent rather than `mine=0` when off, so the plain library keeps the plain
 * URL and nothing has to strip a default out of a shared link.
 */
export const libraryHref = (options: { mine?: boolean } = {}): Route =>
  options.mine ? `${ROUTES.library}?mine=1` : ROUTES.library;

/**
 * One trick, by its **slug** — the canonical data's `id`, not the database id.
 * A URL a rider can read is worth having, and the slug survives a reseed while
 * a record id does not (`tricksFromRecords`).
 */
export const trickHref = (slug: string): Route => `/library/${encodeURIComponent(slug)}`;

/** A guardian's link from the consent email (plan §6.2). */
export const consentHref = (action: 'approve' | 'revoke', token: string): Route =>
  `/consent/${action}/${encodeURIComponent(token)}`;

/**
 * One rider's public profile, by **handle**.
 *
 * Handles are unique case-insensitively and are what appear on a share card, so
 * they are the readable half of a URL a rider might type. Whether the profile
 * opens is not this function's business: the API rules decide, and a profile
 * that is private simply does not resolve (plan §3 guarantee 1).
 */
export const riderHref = (handle: string): Route => `/riders/${encodeURIComponent(handle)}`;

/** The landing page an invite code opens. The only door into a crew (§6.1). */
export const joinHref = (code: string): Route => `/join/${encodeURIComponent(code)}`;

/**
 * The report form, pointed at something.
 *
 * The subject travels in the query string so a "Report this" control anywhere
 * can be an ordinary link — no client state, no modal that has to exist on
 * every screen, and it still works for somebody who arrived signed out. What
 * lands in `subject_id` is only ever a record id the caller could already see;
 * the hook does not read the profile or spot it names, and staff resolve it.
 */
export const reportHref = (subject?: { type: string; id?: string }): Route => {
  if (!subject) return ROUTES.report;
  const query = new URLSearchParams({ about: subject.type });
  if (subject.id) query.set('id', subject.id);
  return `${ROUTES.report}?${query.toString()}`;
};

/** The appeal form, for a complaint about how we handled a report. */
export const appealHref = (reportId?: string): Route =>
  reportId
    ? `${ROUTES.report}?appeal=${encodeURIComponent(reportId)}`
    : (`${ROUTES.report}?appeal=` as Route);

/**
 * Sign in, and come back to where you were sent from.
 *
 * Issue #66: every gated link used to land a signed-out visitor on `/home`,
 * whatever they had clicked — which for an invite link or a friend's profile
 * means the thing they came for is simply gone. The path is carried as a query
 * parameter and validated on the way back out (`safeReturnTo`), because a
 * redirect target a stranger controls is an open redirect.
 */
export const signInHref = (returnTo?: string): Route =>
  returnTo ? `${ROUTES.signIn}?next=${encodeURIComponent(returnTo)}` : ROUTES.signIn;

/**
 * A `next` parameter, if it is safe to send somebody to.
 *
 * Only a same-site absolute path, which means: it starts with one `/`, it does
 * not start with `//` or `/\` (both of which browsers read as a host), and it
 * carries no scheme. Anything else is dropped for the dashboard rather than
 * refused — a rider who followed a mangled link should still get signed in.
 */
export function safeReturnTo(value: string | null | undefined): Route {
  const path = String(value ?? '');
  if (!path.startsWith('/')) return ROUTES.dashboard;
  if (path.startsWith('//') || path.startsWith('/\\')) return ROUTES.dashboard;
  if (/[\s]/.test(path)) return ROUTES.dashboard;
  return path as Route;
}
