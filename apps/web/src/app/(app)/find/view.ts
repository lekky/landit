import type { DistanceUnits } from '@landit/core';

import type { EventView } from '../events/view';
import type { SpotView } from '../spots/view';

/**
 * What the Find hub renders, and the two numbers that decide how much of it.
 *
 * Separate from `load.ts` for the reason `spots/view.ts` is separate from its
 * page: the screen is a client component and `load.ts` reads cookies, so a
 * constant imported across that line would drag `next/headers` into the browser
 * bundle — which is a build error, and the useful kind, because it is the
 * server/client boundary refusing to be crossed by accident.
 */

/** How many rows a hub section shows before it hands over to its own screen. */
export const HUB_EVENTS = 4;
export const HUB_SPOTS = 4;

export interface FindData {
  readonly signedIn: boolean;
  /** Miles or kilometres, settled on the server from the reader's country. */
  readonly units: DistanceUnits;
  /** Upcoming events the rider said yes to, soonest first. Empty for a visitor. */
  readonly going: readonly EventView[];
  /** The next events, minus the ones already under "You're going". */
  readonly coming: readonly EventView[];
  /**
   * The country "Coming up" is narrowed to, or `''` for the whole calendar —
   * said out loud on the screen, the way `/events` says it.
   */
  readonly comingCountry: string;
  /**
   * The spots "Near you" shows until a position is held: the rider's faves
   * first, then spots they have logged a session at. Empty for a visitor, who
   * has neither.
   */
  readonly known: readonly SpotView[];
}
