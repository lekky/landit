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
  home: '/',
  signUp: '/signup',
  signIn: '/signin',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  onboarding: '/onboarding',
  account: '/account',
  library: '/library',
  progress: '/progress',
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
