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
} as const satisfies Record<string, Route>;

export const legalHref = (doc: LegalDocId): Route => `/legal/${doc}`;

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
