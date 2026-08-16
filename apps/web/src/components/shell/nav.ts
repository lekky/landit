import type { IconName } from '@landit/ui-web';
import type { Route } from 'next';

/**
 * The rider app's navigation, from `landit-app.jsx`.
 *
 * `NAV` is the five that also form the fixed bottom bar below 860px; `EXTRA_NAV`
 * is the rest of the top bar, which the bottom bar drops. That split is the
 * design's, not an implementation detail — the handoff specifies a five-item
 * bar and five is what fits.
 *
 * An `href` is present once the screen behind it exists: Home, Tricks and
 * Progress landed in T7 to T9, and Wave 5 filled in the remaining five —
 * Stickers (T10), Crew (T11), Challenge and Events (T12), Spots (T13). Only
 * Plans is still a bare label; T15 fills in its line. One edit is all it takes:
 * the top bar, the bottom bar and the active-state highlighting all read this
 * list.
 *
 * Wave 5's four sessions did **not** each wire their own entry, and the reason
 * is worth keeping. Four concurrent sessions editing one array is four rebase
 * conflicts in the file that decides whether a screen is reachable at all —
 * the one place where "resolve toward origin" (LESSONS §1) silently drops a
 * sibling's line and leaves a merged screen with no way in. So each session
 * added its path to `ROUTES` and stopped there, and this list was wired once,
 * afterwards, when every screen existed. Wave 6 should do the same.
 */

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  /** Absent until the task that owns this screen lands its route. */
  href?: Route;
  /**
   * Other path prefixes this item owns the highlight for.
   *
   * A screen does not always live under the nav entry that means it. A rider
   * profile is `/riders/{handle}` and an invite lands on `/join/{code}`, and
   * both are Crew to a rider even though neither sits under `/crew`. Without
   * this the bar simply blanks on those pages, which reads as "you have left
   * the app" on exactly the two screens a rider is most likely to arrive at
   * from someone else's link.
   */
  alsoActiveFor?: readonly string[];
};

/** The primary five. Also the bottom bar, in this order. */
export const NAV: readonly NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home', href: '/home' },
  { id: 'library', label: 'Tricks', icon: 'grid', href: '/library' },
  { id: 'progress', label: 'Progress', icon: 'chart', href: '/progress' },
  { id: 'stickers', label: 'Stickers', icon: 'star', href: '/stickers' },
  {
    id: 'crew',
    label: 'Crew',
    icon: 'users',
    href: '/crew',
    alsoActiveFor: ['/riders', '/join'],
  },
];

/** Top bar only. */
export const EXTRA_NAV: readonly NavItem[] = [
  { id: 'challenge', label: 'Challenge', icon: 'bolt', href: '/challenge' },
  { id: 'events', label: 'Events', icon: 'flag', href: '/events' },
  { id: 'spots', label: 'Spots', icon: 'map', href: '/spots' },
  { id: 'plans', label: 'Plans', icon: 'crown' },
];

export const TOP_NAV: readonly NavItem[] = [...NAV, ...EXTRA_NAV];

/**
 * Whether a nav item is the one being looked at.
 *
 * A trick page counts as Tricks and a rider profile counts as Crew — the
 * prototype folded both, and the sub-route should not blank the bar. The trick
 * page falls out of the prefix rule (`/library/{slug}` sits under `/library`);
 * the rider profile does not, which is what `alsoActiveFor` is for.
 *
 * `/coach` is deliberately not folded into Crew. It is a view of one rider's
 * own progress rather than a crew screen, and which entry should own it is a
 * design question rather than a wiring one.
 */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (!item.href) return false;
  const owns = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  return owns(item.href) || (item.alsoActiveFor?.some(owns) ?? false);
}
