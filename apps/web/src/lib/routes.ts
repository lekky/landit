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
 */
export const ROUTES = {
  home: '/',
} as const satisfies Record<string, Route>;

/**
 * Whether sign-up and sign-in exist. T6 builds them; until then the landing
 * page's two calls to action and the top bar's Sign in are disabled rather than
 * pointing at a page that is not there.
 *
 * Deleting this constant is part of T6: flip the buttons to links and the
 * `false` branches go with it.
 */
export const AUTH_ROUTES_LIVE = false;

export const legalHref = (doc: LegalDocId): Route => `/legal/${doc}`;
