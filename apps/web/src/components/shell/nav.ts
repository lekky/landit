import type { IconName } from '@landit/ui-web';
import type { Route } from 'next';

import { ROUTES } from '@/lib/routes';

/**
 * The rider app's navigation — two shapes over one set of destinations.
 *
 * `TOP_NAV` is the nine flat entries the design draws across the top bar
 * (`landit-app.jsx`). `MOBILE_NAV` is the five the fixed bottom bar carries
 * below 861px, and it is **not the first five of that list**: it is five
 * *sections*, each owning more than its own route.
 *
 * That difference is the whole point of this file, so it is worth writing down
 * why it exists. The bottom bar started as `TOP_NAV.slice(0, 5)`, which meant
 * that below 861px — where `.nav` is `display: none` — Challenge, Events, Spots
 * and Plans had **no navigation entry at all**. The only way to any of them was
 * the site footer at the bottom of a scrolled page. Four of nine destinations
 * went dark on the one device a rider actually carries to a skatepark, and the
 * four that went dark were the go-and-ride ones: where to skate, what is on,
 * this week's challenge.
 *
 * Five is still the number — the design specifies a five-item bar (handoff,
 * Responsive) and `.mobnav` is `repeat(5, 1fr)`, which at 375px leaves about
 * 75px a cell. Six does not fit a label. So the bar stops trying to be a
 * shortlist of pages and becomes a complete map of sections instead:
 *
 * - **Home** also carries the weekly challenge, which is a today thing and is
 *   already on the dashboard as a card.
 * - **What's on** is Spots and Events together. Both answer "where do I go",
 *   both are geographic, and neither is big enough to spend a fifth of the bar
 *   alone.
 * - **Progress** is progress and the sticker wall together: both are the
 *   rider's own record.
 * - **Tricks** and **Crew** stand alone, as they did.
 *
 * A section that holds two routes shows a `SectionTabs` row at the top of both
 * screens, so the second route is one tap away rather than merely highlighted.
 * `alsoActiveFor` is what keeps the bar lit while a rider is on it.
 *
 * The four destinations that are not sections — Account, Coach view, Plans and
 * Report something — are account-shaped rather than places to ride, and they
 * live behind the top bar's avatar in `AccountMenu`, at every width. That is
 * also how `/report` stops being footer-only, which the OSA codes' "easy to
 * find" wording is better served by (plan §6.1).
 */

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  href: Route;
  /**
   * Destinations this section's own screens link to.
   *
   * The guarantee the bottom bar makes, written down where a test can read it.
   * Folding nine destinations into five sections is only honest if the folded
   * ones are still reachable, so each section states what it reaches and
   * `nav.test.ts` asserts that the five sections plus `ACCOUNT_MENU` between
   * them cover every entry in `TOP_NAV`. Nothing is allowed to be desktop-only.
   *
   * Each claim is real navigation somewhere in the app, and `e2e/shell.spec.ts`
   * clicks it: Home's is the dashboard's challenge card, and the two-screen
   * sections' are their `SectionTabs` rows.
   */
  reaches?: readonly Route[];
  /**
   * Other path prefixes this item owns the highlight for.
   *
   * Two jobs now. A screen does not always live under the nav entry that means
   * it — a rider profile is `/riders/{handle}` and an invite lands on
   * `/join/{code}`, and both are Crew even though neither sits under `/crew`.
   * And a bottom-bar *section* covers routes that are their own top-bar entries
   * on desktop: What's on owns `/events` as well as `/spots`. Without this the
   * bar simply blanks on those pages, which reads as "you have left the app".
   */
  alsoActiveFor?: readonly string[];
};

/**
 * The top bar above 860px: every destination, flat, in the design's order.
 *
 * Unchanged by the bottom-bar restructure, deliberately. Nine items fit a
 * desktop row and grouping them there would hide screens behind a tap for no
 * reason — the squeeze is the phone's, so the answer is the phone's.
 */
export const TOP_NAV: readonly NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home', href: ROUTES.dashboard },
  { id: 'library', label: 'Tricks', icon: 'grid', href: ROUTES.library },
  { id: 'progress', label: 'Progress', icon: 'chart', href: ROUTES.progress },
  { id: 'stickers', label: 'Stickers', icon: 'star', href: ROUTES.stickers },
  {
    id: 'crew',
    label: 'Crew',
    icon: 'users',
    href: ROUTES.crew,
    alsoActiveFor: ['/riders', '/join'],
  },
  { id: 'challenge', label: 'Challenge', icon: 'bolt', href: ROUTES.challenge },
  { id: 'events', label: 'Events', icon: 'flag', href: ROUTES.events },
  { id: 'spots', label: 'Spots', icon: 'map', href: ROUTES.spots },
  { id: 'plans', label: 'Plans', icon: 'crown', href: ROUTES.plans },
];

/**
 * The fixed bottom bar below 861px: five sections, in this order.
 *
 * The order is a phone's, not the top bar's. Home first because it is where a
 * rider lands; Tricks second because logging one is the thing they came to do;
 * **What's on third, in the middle**, because it is the reason to open the app
 * while standing outside a skatepark and the middle cell is the easiest reach
 * on a phone held one-handed. Progress and Crew, both of which are read rather
 * than acted on, take the outside.
 *
 * Every label has to survive `.mobnav` at 375px: uppercase, 10.5px, 0.09em
 * tracking, in about 71px of usable cell. "What's on" is the longest and it is
 * held on one line by `white-space: nowrap` plus a slightly tighter track for
 * that item (`additions.css`); `e2e/shell.spec.ts` measures it rather than
 * trusting the arithmetic.
 */
export const MOBILE_NAV: readonly NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: 'home',
    href: ROUTES.dashboard,
    // The dashboard carries the weekly challenge as a card, and that card is
    // the way in, so the bar stays on Home rather than blanking on `/challenge`.
    reaches: [ROUTES.challenge],
  },
  { id: 'library', label: 'Tricks', icon: 'grid', href: ROUTES.library },
  {
    id: 'whats-on',
    label: 'What’s on',
    icon: 'map',
    href: ROUTES.spots,
    reaches: [ROUTES.events],
  },
  {
    id: 'progress',
    label: 'Progress',
    icon: 'chart',
    href: ROUTES.progress,
    reaches: [ROUTES.stickers],
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
 * Whether a nav item is the one being looked at.
 *
 * A trick page counts as Tricks and a rider profile counts as Crew — the
 * prototype folded both, and the sub-route should not blank the bar. The trick
 * page falls out of the prefix rule (`/library/{slug}` sits under `/library`);
 * the rider profile does not, which is what `alsoActiveFor` is for.
 *
 * `/coach` is deliberately not folded into Crew. It is a view of one rider's
 * own progress rather than a crew screen, and it is reached from the account
 * menu, which is not part of either bar.
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
 * One tab row, for a section that holds two screens (`SectionTabs`).
 *
 * The tabs are here rather than beside the component because they are
 * navigation, and because they are the mechanism behind two of the `reaches`
 * claims above — keeping them in the same file is what lets one test check the
 * claim against the thing that honours it.
 */
export type SectionTab = {
  id: string;
  label: string;
  icon: IconName;
  href: Route;
};

/** The two screens under the bottom bar's "What's on". */
export const WHATS_ON_TABS: readonly SectionTab[] = [
  { id: 'spots', label: 'Spots', icon: 'map', href: ROUTES.spots },
  { id: 'events', label: 'Events', icon: 'flag', href: ROUTES.events },
];

/** The two screens under the bottom bar's "Progress". */
export const PROGRESS_TABS: readonly SectionTab[] = [
  { id: 'progress', label: 'Progress', icon: 'chart', href: ROUTES.progress },
  { id: 'stickers', label: 'Stickers', icon: 'star', href: ROUTES.stickers },
];

/**
 * What the top bar's avatar opens (`AccountMenu`).
 *
 * Here rather than in the component because it is navigation, and because the
 * covers-everything test above has to be able to count it: these four are the
 * reason Plans does not need a cell in a five-item bar, and the reason
 * `/report` is no longer reachable on a phone only from the site footer.
 */
export const ACCOUNT_MENU: readonly { id: string; label: string; href: Route }[] = [
  { id: 'account', label: 'Your account', href: ROUTES.account },
  { id: 'coach', label: 'Coach / parent view', href: ROUTES.coach },
  { id: 'plans', label: 'Plans and pricing', href: ROUTES.plans },
  { id: 'report', label: 'Report something', href: ROUTES.report },
];
