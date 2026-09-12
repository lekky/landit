import type { CategoryId, SportId } from '@landit/core';
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
  verifyEmail: '/verify-email',
  onboarding: '/onboarding',
  account: '/account',
  library: '/library',
  /**
   * The glossary (T29): the words riders use, readable signed out like the
   * library. A term is addressed by hash — see `glossaryHref`.
   */
  glossary: '/glossary',
  progress: '/progress',
  /**
   * T12's two screens. Reachable by URL from the moment they merge; the nav
   * entries that point at them are wired separately, once every Wave 5 screen
   * exists, so four concurrent sessions do not all edit `components/shell/nav.ts`.
   */
  challenge: '/challenge',
  events: '/events',
  /**
   * The archive — every event that has already happened, at an address of its
   * own rather than as a filter buried in the calendar's pill row.
   *
   * A route rather than client state because it is the half of the calendar
   * worth *arriving* on: a rider looking up what happened at their park last
   * summer is coming from a search result, and there was nothing for one to
   * point at. `/events/past/[year]/[town]` narrows it, and only the corners
   * that hold events are ever published (`eventArchiveIndex`).
   */
  eventsPast: '/events/past',
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
   * Why the product exists, told by the rider whose idea it was.
   *
   * A route of its own rather than a sixth legal document. `/legal/about` is
   * the factual page — what this is, how it makes money, who to email — and it
   * sits in a set with the privacy policy and the terms because that is the
   * register it is written in. The story is a different kind of page and would
   * have had to borrow that one's index down the left to live there.
   */
  story: '/story',
  /**
   * The staff portal (T16), and the one route here that is not for riders.
   *
   * It is in neither bar, and that has not changed: a link two people use does
   * not earn one of nine top-bar slots or one of five on a phone. What changed
   * (2026-09-12) is that staff no longer reach it only by typing the address —
   * the top bar's avatar menu carries it as a fifth item for accounts whose
   * `role` is `staff`, and for nobody else (`accountMenuFor` in
   * `components/shell/nav.ts`).
   *
   * The design question this used to record as unanswered — "a real bar would
   * have to render conditionally on `role`, on every page" — is answered by
   * where the conditional sits: one `isStaff` call in `app/(app)/layout.tsx`,
   * which already holds the rider record for the streak chip and the avatar, so
   * the menu costs no extra read. Hiding the item is presentation only;
   * `requireStaff` is still what decides whether this route exists for the
   * person asking, and still answers a 404 rather than a 403.
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

/**
 * A legal document, optionally at one of its sections.
 *
 * The anchor comes from `legalSectionId`, which the page uses for the matching
 * `id`, so a caller cannot invent a fragment that lands nowhere. `typedRoutes`
 * checks the path against the route table and does not model fragments, hence
 * the cast on the second form only.
 */
export const legalHref = (doc: LegalDocId, sectionId?: string): Route =>
  sectionId ? (`/legal/${doc}#${sectionId}` as Route) : `/legal/${doc}`;

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
export const libraryHref = (options: { mine?: boolean; cat?: CategoryId } = {}): Route => {
  const query = new URLSearchParams();
  if (options.mine) query.set('mine', '1');
  /*
   * `?cat=` joined `?mine=1` when spot pages landed (2026-09-06). A spot page's
   * "What's here" grid ends each feature with a link to the tricks you would do
   * on it, and there was no way to *address* a narrowed library — the category
   * pills are client state, so every one of those links would have opened the
   * whole library and left the reader to find the filter themselves.
   *
   * A parameter rather than a route, for the reason `mine` gives above: it is
   * the same library with the same pills still applying, and the reader can
   * clear it in one press. What it buys is that "Bowl tricks →" goes somewhere
   * specific, and that a rider can bookmark or share the park tricks.
   */
  if (options.cat) query.set('cat', options.cat);
  const search = query.toString();
  return search ? (`${ROUTES.library}?${search}` as Route) : ROUTES.library;
};

/**
 * The glossary, optionally opened at one term and told which trick the reader
 * left to get there (T29).
 *
 * `from` carries a trick slug, and it is what turns "Back to the trick" on: a
 * reader who followed a dotted word out of a trick's tips wants the way back,
 * and a reader who arrived from the footer wants the library. A query parameter
 * rather than a referrer check, for the reason `eventHrefFrom` gives. The hash
 * goes after the query string, because a fragment before one is not a
 * fragment: `/glossary?from=tailwhip#kerb`.
 */
export const glossaryHref = (slug?: string, from?: string): Route => {
  const search = from ? `?from=${encodeURIComponent(from)}` : '';
  const hash = slug ? `#${encodeURIComponent(slug)}` : '';
  return `${ROUTES.glossary}${search}${hash}` as Route;
};

/**
 * The glossary narrowed to one sport, or all of it — the filter row's address,
 * so `/glossary?sport=skate` can be linked and bookmarked like `/library?mine=1`.
 * `from` rides along so the way back survives a filter press.
 */
export const glossarySportHref = (sport: SportId | null, from?: string | null): Route => {
  const params = new URLSearchParams();
  if (sport) params.set('sport', sport);
  if (from) params.set('from', from);
  const search = params.toString();
  return search ? (`${ROUTES.glossary}?${search}` as Route) : ROUTES.glossary;
};

/**
 * The spots list, optionally narrowed to one feature (T31).
 *
 * `/spots?feature=flat` is where a trick page's "Where to practise" line goes:
 * a rider reading about a flat trick is one press from every spot tagged with
 * flat ground. A parameter rather than a route, for the reason `libraryHref`
 * gives for `?cat=` — it is the same list with the same search and sport pills
 * still applying, and the reader clears it in one press. The value is a tag
 * from `SPOT_FEATURES`; the screen validates it and ignores anything else, so
 * a mangled link opens the plain list rather than an empty one.
 */
export const spotsHref = (options: { feature?: string } = {}): Route =>
  options.feature
    ? (`${ROUTES.spots}?feature=${encodeURIComponent(options.feature)}` as Route)
    : ROUTES.spots;

/**
 * One spot, by the slug on its record.
 *
 * A slug rather than the record id, for the reason `trickHref` gives: an id is
 * fifteen random characters that say nothing in a shared link and do not
 * survive a reseed, and this URL's entire job is to be shared and crawled.
 * Only spots staff have approved have a page at all — `getSpotBySlug` is where
 * that is enforced — so a link built here for a `pending` spot lands on a 404,
 * which is the correct answer rather than a bug.
 */
export const spotHref = (slug: string): Route => `/spots/${encodeURIComponent(slug)}`;

/**
 * One trick, by its **slug** — the canonical data's `id`, not the database id.
 * A URL a rider can read is worth having, and the slug survives a reseed while
 * a record id does not (`tricksFromRecords`).
 */
export const trickHref = (slug: string): Route => `/library/${encodeURIComponent(slug)}`;

/**
 * One event, by its **slug** — `events.slug`, the same key `event_attendance`
 * is toggled with and the same one the seed's natural key is built on.
 *
 * A record id would work and would be worse: it changes on a reseed, it means
 * nothing to a rider reading the address bar, and it is the sort of value that
 * ends up in somebody's network tab (`events/actions.ts` makes the same
 * argument about the form value).
 */
export const eventHref = (slug: string): Route => `/events/${encodeURIComponent(slug)}`;

/**
 * The same page, told where the reader came from, for `event_page_opened`.
 *
 * A query parameter rather than a referrer check: the two doors into this page
 * that we want to tell apart — a row in the list and the modal's full-page CTA
 * — are both on `/events`, so a referrer cannot separate them. `direct` needs
 * no parameter, which keeps the shared and canonical URL the plain one.
 */
export type EventPageSource = 'list' | 'modal_cta';

export const eventHrefFrom = (slug: string, source: EventPageSource): Route =>
  `${eventHref(slug)}?from=${source}`;

/**
 * The Details modal, at an address (Rachid, 2026-09-06, in chat).
 *
 * A query parameter over `/events`, not an intercepted route. The modal is the
 * quick look *over the list a rider has already filtered* — their sport tab,
 * their search, their page and their optimistic "I'm going" all belong to the
 * client component underneath it, and an intercepted `(.)events/[slug]` would
 * render a second, server-side tree that has none of that. It would also show
 * the wrong thing: `/events/[slug]` is a full page with a rail, a map and three
 * onward blocks, deliberately not the modal's content.
 *
 * What the parameter buys is everything the design asked for — the modal is
 * linkable, and Back closes it, because opening it pushes one history entry.
 */
export const eventModalHref = (slug: string): Route =>
  `${ROUTES.events}?event=${encodeURIComponent(slug)}`;

/**
 * One corner of the archive, or the whole of it.
 *
 * Both segments or neither: a year without a town would be a third page shape
 * to design, and the index panel does that job by filtering the list in place.
 * The town travels as a slug because that is the only form the reader's browser
 * sends back (`eventTownSlug`).
 */
export const pastEventsHref = (where?: { year: number; townSlug: string }): Route =>
  where
    ? `${ROUTES.eventsPast}/${where.year}/${encodeURIComponent(where.townSlug)}`
    : ROUTES.eventsPast;

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
