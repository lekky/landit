import type {
  ClipPlatformId,
  RideSession,
  SessionFeelId,
  SessionVisibilityId,
  SessionWeatherId,
  SportId,
} from '@landit/core';
import type { Route } from 'next';

/**
 * What the Sessions tab (T37) hands from the server to the browser.
 *
 * Everything a rider reads is resolved into a finished string on the server —
 * day names, month names, clock times, spot and trick names — because a label
 * that is formatted on both sides of hydration is a mismatch waiting to happen
 * (LESSONS §3a). The raw `RideSession` rides along so the client can filter,
 * group and sum with `@landit/core`'s own functions rather than re-deriving
 * them from the strings.
 *
 * Its own module, with no server imports, so the client components can take
 * the types without pulling `@landit/db` into the browser bundle.
 */

/** A name, and where it goes — `null` when the thing has no page to open. */
export interface LinkedName {
  readonly name: string;
  readonly href: Route | null;
}

export interface SessionTrickView {
  readonly key: string;
  readonly name: string;
  readonly href: Route | null;
  /** "→ Most times", or empty when this session moved nothing. */
  readonly move: string;
}

export interface SessionCardView {
  readonly id: string;
  /** The session itself, for core's filters and month groups. */
  readonly session: RideSession;
  readonly viewHref: Route;
  readonly editHref: Route;
  /** "Sat", "12", "Sep" — the desktop date rail. */
  readonly dow: string;
  readonly day: string;
  readonly mon: string;
  /** "12 Sep" — the phone heading, the table, the delete confirm. */
  readonly dateLabel: string;
  /** "19 July 2026" and "19 Jul", for "Since …" when this is the oldest shown. */
  readonly sinceLong: string;
  readonly sinceShort: string;
  /** "14:00", on the rider's clock. */
  readonly time: string;
  /** Ridden on the rider's today — the yellow rail. */
  readonly isToday: boolean;
  readonly spot: LinkedName;
  readonly event: LinkedName | null;
  readonly sport: { readonly id: SportId; readonly label: string; readonly art: string };
  /** "2h", "3h+". */
  readonly duration: string;
  readonly weather: { readonly id: SessionWeatherId; readonly label: string } | null;
  readonly feel: { readonly id: SessionFeelId; readonly label: string; readonly color: string };
  /** "Ollie, Mia" — only the crew-mates the server let this reader see (D3). */
  readonly crew: string;
  readonly aim: string;
  readonly notes: string;
  readonly tricks: readonly SessionTrickView[];
  readonly clip: {
    readonly platform: ClipPlatformId;
    /** Core's `clipWatchUrl` — never a string a rider typed. */
    readonly href: string;
    readonly label: string;
    readonly color: string;
  } | null;
  readonly visibility: {
    readonly id: SessionVisibilityId;
    readonly label: string;
    readonly blurb: string;
  };
  /** A trick moved up a stage in this session. */
  readonly moved: boolean;
}

export interface SessionsQuotaView {
  /** "One left this month". */
  readonly line: string;
  readonly pips: readonly ('used' | 'free')[];
  /** "Rookie logs four sessions a month. Yours resets on 1 October." */
  readonly copy: string;
}

export interface SessionsTopSpotView {
  readonly spotId: string;
  readonly name: string;
  readonly href: Route | null;
  readonly count: number;
  /** Bar width in px. */
  readonly bar: number;
}

export interface SessionsSidebarView {
  /** "September". */
  readonly monthName: string;
  readonly sessions: number;
  /** "5h 45m". */
  readonly time: string;
  readonly stageMoves: number;
  readonly spotsRidden: number;
  /** "12 weeks" — the weekly streak, in the unit the streak counts. */
  readonly streakLabel: string;
  /** `null` on a plan with no monthly cap: there is nothing to count down. */
  readonly quota: SessionsQuotaView | null;
  readonly topSpots: readonly SessionsTopSpotView[];
}

export interface SessionsView {
  /** Every session the rider has, newest first. */
  readonly sessions: readonly SessionCardView[];
  readonly timezone: string;
  /** `YYYY-MM` on the rider's clock. */
  readonly currentMonthKey: string;
  /** The sport chips to offer; empty for a one-sport rider. */
  readonly filterSports: readonly { readonly id: SportId; readonly label: string }[];
  readonly sidebar: SessionsSidebarView;
}
