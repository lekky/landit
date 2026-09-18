import type { IconName } from '@landit/ui-web';
import type { Route } from 'next';

import { ROUTES } from '@/lib/routes';
import { SESSIONS_PATH } from '@/lib/sessionRoutes';

/**
 * The rider app's navigation — **four groups, at every width**.
 *
 * This file used to hold two different maps of the same product: nine flat
 * entries across the top bar, and five folded sections in the bottom bar, with
 * a drawer to reveal what the folding hid. The app shell rethink (Rachid,
 * 2026-09-15 and 2026-09-16, in chat; `docs/app-shell-rethink.md`) replaced
 * both with one map, and this file is now much duller than it was, which is
 * the point.
 *
 * **Home · Tricks · Find · Crew**, plus LOG, which is not a destination at all.
 *
 * - **Home** is the dashboard and the four screens that are the rider's own
 *   record: Progress, Sessions, Stickers and the weekly Challenge. They are
 *   reached from cards on Home (T46) and each carries a Home back link.
 * - **Tricks** is the library, a trick page and the glossary.
 * - **Find** is where to ride: the `/find` summary, Spots, Events, the archive
 *   and the rider's own events (D2, T48). The route is a redirect to `/spots`
 *   until T48 lands the summary.
 * - **Crew** is the crew, rider profiles and an invite.
 * - **LOG** is the middle cell of the phone's bar and the yellow button beside
 *   the sport chip on a desktop. It opens a sheet (D3) and goes nowhere, so it
 *   has no entry here: `MobileNav` draws it between the second and third group
 *   and `TopBar` draws it in the right-hand group.
 *
 * Three things that are **not** in either bar and are reached from the top bar
 * at every width: the avatar's menu (`ACCOUNT_MENU` — account, coach view,
 * plans, an idea, a report, and for staff the portal), the sport chip (D5), and
 * the bell's `/whats-new` (D4, `BELL_DESTINATION`). None of them lights a cell.
 *
 * **`DESTINATIONS` is the promise the bars make**, and `lib/nav.test.ts` is
 * what checks it. Folding a product into four groups is only honest if nothing
 * is left with no way in on a phone, which is exactly what went wrong the last
 * time this file was reshaped: the bar was `TOP_NAV.slice(0, 5)` and four
 * screens were reachable on a phone only from the site footer at the bottom of
 * a scrolled page. The old test asked "is every top-bar entry on the phone",
 * which stops meaning anything now the two bars are the same list — so the list
 * of everywhere a rider can go is written out below instead, and every entry in
 * it has to be a group, something a group reaches, an account-menu item or the
 * bell.
 */

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  href: Route;
  /**
   * The screens this group holds, beyond its own sub-routes.
   *
   * Two jobs, as before. It is the group's claim that these have a way in —
   * `nav.test.ts` reads it — and it lights the group's cell while a rider is on
   * one of them (`isNavActive`), which is what §2.2 of the spec asks for: a
   * rider on `/progress` sees Home lit, a rider on `/spots/[slug]` sees Find.
   *
   * Every claim is real navigation somewhere in the app: the Home cards (T46)
   * and the Find tab row (T48) are what a rider actually presses.
   */
  reaches?: readonly Route[];
  /**
   * Other path prefixes this group owns the highlight for, without claiming to
   * be the way in.
   *
   * A rider profile is `/riders/{handle}` and an invite lands on `/join/{code}`
   * — both are Crew, and neither is somewhere the bar sends anybody. Without
   * this the bar simply blanks on those pages, which reads as "you have left
   * the app".
   */
  alsoActiveFor?: readonly string[];
};

/**
 * The four groups, in the order both bars draw them.
 *
 * The phone's bar puts LOG between Tricks and Find, so this order is also the
 * order of the bar's cells with the middle one taken out: Home, Tricks, [LOG],
 * Find, Crew (D1).
 */
export const NAV_GROUPS: readonly NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: 'home',
    href: ROUTES.dashboard,
    /*
     * The four record screens, reached from Home's cards (T46). Sessions is
     * added by `navFor` only for a rider the preview covers — a claim to a
     * screen that would 404 is worse than no claim.
     */
    reaches: [ROUTES.progress, ROUTES.stickers, ROUTES.challenge],
  },
  {
    id: 'library',
    label: 'Tricks',
    icon: 'grid',
    // The glossary is the library's own reference page, reached from a trick's
    // copy and pointing back into it; it does not sit under `/library`.
    href: ROUTES.library,
    reaches: [ROUTES.glossary],
  },
  {
    id: 'find',
    label: 'Find',
    icon: 'map',
    href: ROUTES.find,
    reaches: [ROUTES.spots, ROUTES.events, ROUTES.eventsPast, ROUTES.eventsMine],
  },
  {
    id: 'crew',
    label: 'Crew',
    icon: 'users',
    href: ROUTES.crew,
    alsoActiveFor: ['/riders', '/join'],
  },
];

/**
 * The top bar above 860px and the bottom bar below it — **the same four**.
 *
 * Both names are kept because both bars read one of them and a reader looking
 * for either should find it. That they are now the same object is the decision
 * (D8): a desktop that grouped its nav differently from the phone would be two
 * products to learn, and the screens that lost a top-bar entry — Progress,
 * Sessions, Stickers, Challenge, Plans — all gained a card or a menu row that
 * is easier to find than a ninth item in a crowded row was.
 */
export const TOP_NAV = NAV_GROUPS;
export const MOBILE_NAV = NAV_GROUPS;

/** Where the top bar's bell goes on a phone. It lights no cell (§2.2). */
export const BELL_DESTINATION: Route = ROUTES.whatsNew;

/**
 * Everywhere in the rider app a rider can go, and the list the bars are held
 * against.
 *
 * Not derived from the groups, deliberately — a list derived from the thing it
 * checks cannot fail. Adding a screen to the product means adding it here, and
 * then the test says which group has to reach it, or which menu.
 */
export const DESTINATIONS: readonly Route[] = [
  ROUTES.dashboard,
  ROUTES.progress,
  SESSIONS_PATH as Route,
  ROUTES.stickers,
  ROUTES.challenge,
  ROUTES.library,
  ROUTES.glossary,
  ROUTES.find,
  ROUTES.spots,
  ROUTES.events,
  ROUTES.eventsPast,
  ROUTES.eventsMine,
  ROUTES.crew,
  ROUTES.whatsNew,
  ROUTES.account,
  /*
   * The six screens `/account` is a list of (rethink §3.9, T51). They are
   * destinations like any other — a rider can link to one, bookmark one and
   * land on one after signing in — so they are written out here and the account
   * menu's own row is what claims them (`reaches`, below). Leaving them off
   * would be the old defect in a new place: a screen a rider can reach only by
   * typing its address.
   */
  ROUTES.accountProfile,
  ROUTES.accountSports,
  ROUTES.accountPrivacy,
  ROUTES.accountSessions,
  ROUTES.accountGuardian,
  ROUTES.accountData,
  ROUTES.coach,
  ROUTES.plans,
  ROUTES.suggest,
  ROUTES.report,
];

/**
 * The four groups for this rider (plan §7, T41).
 *
 * The only thing a rider's record changes about the bars: with sessions on,
 * Home **claims** `/progress/sessions`, so the covers-everything test can count
 * it. It does not change what is lit — `/progress/sessions` sits under
 * `/progress`, which Home already reaches, so `isNavActive` answers Home on
 * that path either way. The claim is a promise about reachability, and it is
 * withheld from a rider outside the preview because a bar that claims a screen
 * which would 404 on them is a bar telling them something untrue.
 *
 * Shaped like `accountMenuFor(staff)` and for the same reason: whether a
 * destination is drawn is a display rule decided once, on the server, from the
 * rider record. The gate that matters is still `sessionsEnabledFor` on each
 * `/progress/sessions` route.
 */
export function navFor(sessionsEnabled?: boolean): readonly NavItem[] {
  if (!sessionsEnabled) return NAV_GROUPS;
  return NAV_GROUPS.map((item) =>
    item.id === 'home'
      ? { ...item, reaches: [...(item.reaches ?? []), SESSIONS_PATH as Route] }
      : item,
  );
}

/** Both bars read the same list; these two names are what each one calls it. */
export const topNavFor = navFor;
export const mobileNavFor = navFor;

/**
 * Whether a nav item is the one being looked at.
 *
 * A trick page counts as Tricks and a rider profile counts as Crew — the
 * prototype folded both, and the sub-route should not blank the bar. The trick
 * page falls out of the prefix rule (`/library/{slug}` sits under `/library`);
 * the rider profile does not, which is what `alsoActiveFor` is for.
 *
 * `/coach` is deliberately not folded into Crew. It is a view of one rider's
 * own progress rather than a crew screen, and it is reached from the account
 * menu, which is not part of either bar. `/account`, `/plans`, `/suggest`,
 * `/report` and `/whats-new` light nothing either, for the same reason.
 */
export function isNavActive(item: NavItem, pathname: string): boolean {
  const owns = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  return (
    owns(item.href) ||
    (item.reaches?.some(owns) ?? false) ||
    (item.alsoActiveFor?.some(owns) ?? false)
  );
}

/**
 * What the top bar's avatar opens (`AccountMenu`).
 *
 * Here rather than in the component because it is navigation, and because the
 * covers-everything test above has to be able to count it: these five are the
 * reason Plans does not need a cell in a four-group bar, and the reason
 * `/report` is not reachable on a phone only from the site footer.
 */
export type AccountMenuItem = {
  readonly id: string;
  readonly label: string;
  readonly href: Route;
  /**
   * Drawn as staff's rather than as a rider destination.
   *
   * Only the portal carries it, and it is a presentation flag, not a gate:
   * whether the item is in the menu at all is decided by `accountMenuFor`.
   */
  readonly staff?: true;
  /**
   * The screens this row's own screen is a list of.
   *
   * The same job `reaches` does on a nav group: it is the claim the menu makes
   * that these have a way in, and it is what `nav.test.ts` counts. Nothing
   * draws it — the menu is still six rows — so it never widens the panel.
   *
   * Two of the account's six are drawn only for the riders they are about:
   * "Who sees new sessions" while the preview covers them, "Your guardian"
   * while the consent gate applies. Both are listed here anyway, because both
   * answer everybody else with a redirect back to the list rather than a 404 —
   * the claim is that the rider it is about can get to it, and that holds.
   */
  readonly reaches?: readonly Route[];
};

export const ACCOUNT_MENU: readonly AccountMenuItem[] = [
  {
    id: 'account',
    label: 'Your account',
    href: ROUTES.account,
    reaches: [
      ROUTES.accountProfile,
      ROUTES.accountSports,
      ROUTES.accountPrivacy,
      ROUTES.accountSessions,
      ROUTES.accountGuardian,
      ROUTES.accountData,
    ],
  },
  { id: 'coach', label: 'Coach / parent view', href: ROUTES.coach },
  { id: 'plans', label: 'Plans and pricing', href: ROUTES.plans },
  /*
   * The two "tell us something" routes, in this order and next to each other.
   *
   * Ideas first, deliberately. The register descends — account, plans, an idea,
   * something wrong — and a rider scanning the menu meets the cheerful one
   * before the safeguarding one, which is the right way round for a list most
   * people open looking for their account. They are adjacent because a rider
   * who is not sure which of the two they want should be able to see both
   * without scrolling, and because that adjacency is what stops ideas being
   * filed as reports (`/suggest`'s doc comment).
   */
  { id: 'suggest', label: 'Tell us an idea', href: ROUTES.suggest },
  { id: 'report', label: 'Report something', href: ROUTES.report },
];

/**
 * The staff portal's way in, for the handful of accounts that have one.
 *
 * Last, and behind a heavier keyline than the five above it (`additions.css`),
 * because it is a different register: the five are about the rider reading
 * them, and this one is about everybody else's data. It is not a nav group — a
 * link two people use does not earn a cell in a four-cell bar, and the menu is
 * already the place for destinations that are not places to ride.
 *
 * Until T42 `/admin` was reached by typing the address, which `lib/routes.ts`
 * recorded as a deliberate hold rather than a decision: a nav entry "would have
 * to render conditionally on `role`, on every page". It does now, and the
 * conditional is one boolean computed once in `app/(app)/layout.tsx`.
 */
export const ACCOUNT_MENU_ADMIN: AccountMenuItem = {
  id: 'admin',
  label: 'Admin portal',
  href: ROUTES.admin,
  staff: true,
};

/**
 * What this rider's avatar opens.
 *
 * **This is a display rule and nothing else.** The portal's actual gate is
 * `requireStaff` in the `/admin` layout, re-checked in every server action
 * behind it; a rider who forges the flag in their own browser, or who simply
 * types the address, still meets the 404 that `lib/staff.ts` explains. What
 * hiding the item buys is the other half of that 404: a rider who is not staff
 * is never told the portal exists (plan §3 guarantee 1's register), and a staff
 * member does not have to remember a URL.
 */
export function accountMenuFor(staff?: boolean): readonly AccountMenuItem[] {
  return staff ? [...ACCOUNT_MENU, ACCOUNT_MENU_ADMIN] : ACCOUNT_MENU;
}
