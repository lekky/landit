import type { SportId, TrickSort, TrickStatusFilter } from '@landit/core';
import type { Route } from 'next';

import { ROUTES } from './routes';

/**
 * Where a rider was in the trick library, kept for the one hop into a trick
 * page and back.
 *
 * ## Why this exists
 *
 * The library is a grid of up to 259 cards and the only way into a trick page.
 * A rider scrolling to the bottom of it, opening a trick and coming back landed
 * at the top of an unnarrowed grid every time: the page re-renders from
 * scratch, so the search box, the tier, the status and the sort — all React
 * state in `LibraryBrowser` — were gone, and the browser's own scroll
 * restoration has nothing to restore to while the new tree is still rendering
 * (the App Router leaves back/forward scroll to the browser and scrolls to the
 * top on a forward navigation). Comparing one trick with another meant
 * re-narrowing and re-scrolling every single time.
 *
 * ## What it promises, exactly
 *
 * **One hop, and only from the library into a trick page.** The place is
 * recorded when `LibraryBrowser` unmounts, honoured when the library renders
 * again, and **forgotten the moment the rider is on a screen outside
 * `/library`** — `noteScreen` is called for every screen in the app shell and
 * is what enforces that. So library → trick → back restores; library → trick →
 * home → library does not, and gets the plain top-of-grid arrival it always
 * got.
 *
 * **In memory, and nowhere else.** No `sessionStorage`, no `localStorage`, no
 * cookie, no query parameter — the same rule `useHereOnce` follows and for the
 * same reason: a rider's half-typed search is theirs, and a reload or a new tab
 * should start clean. The module-level state below lives for as long as the tab
 * does and dies with it. (The sport switch is the deliberate exception: a
 * *preference* is worth keeping, where a scroll offset is not.)
 *
 * **Nothing here is written on the server.** `rememberLibraryPlace` and
 * `noteScreen` are only ever called from effects, which never run during a
 * server render, so `place` is always `null` on the server and this module
 * cannot leak one request's view into another's. Keep it that way: a write from
 * a render path would be shared by every rider the process is serving.
 *
 * ## The day this file should be deleted
 *
 * Next 16 ships **Cache Components** (`cacheComponents: true`), which keeps a
 * navigated-away page mounted inside React's `<Activity>` — hidden rather than
 * unmounted — and with it the component state, the DOM and the scroll position
 * of the last three routes (`next/dist/docs/01-app/02-guides/preserving-ui-state.md`).
 * That is this whole file, for every screen, done by the framework. It is off in
 * `next.config.ts` and turning it on is a repo-wide caching decision, not a
 * library one. If a later session enables it, check whether the library still
 * needs any of this before leaving it in: two mechanisms restoring one scroll
 * offset is how a rider ends up somewhere neither of them meant.
 *
 * ## What the address owns, and what this owns
 *
 * `?mine=1` and `?cat=` are in the URL (see `libraryHref`) and stay there: the
 * server resolves them so the first paint is already the right list. This holds
 * the half that has no address — the search text, the tier, the status and the
 * sort — plus the scroll offset and the library address to return to, so that
 * a trick page's "All tricks" arrow lands on the same URL a browser Back would.
 */

/** The narrowing a rider built with the controls that live in React state. */
export interface LibraryNarrowing {
  readonly search: string;
  readonly difficulty: number | null;
  readonly status: TrickStatusFilter;
  readonly sort: TrickSort;
}

export interface LibraryPlace {
  /** The library address the rider left, which owns `mine` and `cat`. */
  readonly href: Route;
  /** Which sport's grid it was. A place in one sport is not a place in another. */
  readonly sport: SportId;
  readonly narrowing: LibraryNarrowing;
  /** The document offset, read as the rider left. */
  readonly scrollY: number;
}

/**
 * The one remembered place, or none.
 *
 * Module state rather than a context because it has to survive the library
 * unmounting, which is precisely when a context inside the page would go with
 * it. The `(app)` layout does persist across these navigations, but a provider
 * there would mean threading a setter through the shell for something no screen
 * but this one asks about.
 */
let place: LibraryPlace | null = null;

/** Whether a path is the library or one of its trick pages. */
export function withinLibrary(path: string): boolean {
  return path === ROUTES.library || path.startsWith(`${ROUTES.library}/`);
}

/**
 * Record where the rider is leaving the library from. Called from
 * `LibraryBrowser`'s cleanup, so the offset is the one they actually left at.
 */
export function rememberLibraryPlace(next: LibraryPlace): void {
  place = next;
}

/**
 * Tell the memory which screen the rider is on now.
 *
 * Anything outside the library forgets the place, which is the whole of the
 * "one hop" promise above. Called by `PlaceKeeper` in the app shell rather than
 * by the screens themselves: a new screen should not have to remember to opt
 * out of somebody else's memory.
 */
export function noteScreen(path: string): void {
  if (!withinLibrary(path)) place = null;
}

/** What a rider arriving back at the library gets put back into. */
export interface LibraryArrival {
  /**
   * The narrowing to reinstate, or `null` when the remembered place belongs to
   * another sport's grid — in which case the arrival is a plain one and the
   * offset below is the top.
   */
  readonly narrowing: LibraryNarrowing | null;
  readonly scrollY: number;
}

/**
 * Where to put a rider who has just arrived at the library, or `null` when they
 * did not come from a trick page and should get the ordinary top-of-grid
 * arrival.
 *
 * A read, not a take: it stays valid until the rider leaves the library, so
 * calling it twice — which React does in development, on purpose — answers the
 * same thing twice.
 *
 * A place recorded in another sport's grid answers `{ narrowing: null,
 * scrollY: 0 }` rather than `null`. Both mean "top of the grid", but the caller
 * has told the browser not to scroll on its own by then, so the difference is
 * between landing at the top and landing wherever the trick page happened to
 * be scrolled to. Nothing can switch sports on a trick page today; this is what
 * happens if something ever can.
 */
export function libraryArrival(sport: SportId): LibraryArrival | null {
  if (!place) return null;
  return place.sport === sport
    ? { narrowing: place.narrowing, scrollY: place.scrollY }
    : { narrowing: null, scrollY: 0 };
}

/** The library address to return to, for a trick page's back arrow. */
export function rememberedLibraryHref(): Route | null {
  return place?.href ?? null;
}

/** Drop the memory outright. Exported for the tests. */
export function forgetLibraryPlace(): void {
  place = null;
}
