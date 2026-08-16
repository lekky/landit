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
 * Every `href` is absent because no screen exists yet. When your task lands
 * one, fill it in here: the top bar, the bottom bar and the active-state
 * highlighting all read this list, so that is the only edit needed.
 */

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  /** Absent until the task that owns this screen lands its route. */
  href?: Route;
};

/** The primary five. Also the bottom bar, in this order. */
export const NAV: readonly NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'library', label: 'Tricks', icon: 'grid', href: '/library' },
  { id: 'progress', label: 'Progress', icon: 'chart', href: '/progress' },
  { id: 'stickers', label: 'Stickers', icon: 'star' },
  { id: 'crew', label: 'Crew', icon: 'users' },
];

/** Top bar only. */
export const EXTRA_NAV: readonly NavItem[] = [
  { id: 'challenge', label: 'Challenge', icon: 'bolt' },
  { id: 'events', label: 'Events', icon: 'flag' },
  { id: 'spots', label: 'Spots', icon: 'map' },
  { id: 'plans', label: 'Plans', icon: 'crown' },
];

export const TOP_NAV: readonly NavItem[] = [...NAV, ...EXTRA_NAV];

/**
 * Whether a nav item is the one being looked at.
 *
 * A trick page counts as Tricks and a rider profile counts as Crew — the
 * prototype folded both, and the sub-route should not blank the bar.
 */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (!item.href) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
