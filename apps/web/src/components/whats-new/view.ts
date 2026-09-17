import type { WhatsNewKind } from '@landit/core';
import type { SportLook } from '@landit/ui-web';

/**
 * Everything the What's new panel renders, computed on the server.
 *
 * The same split as the crew screen's `view.ts` and for the same reason: the
 * panel is a client component because its tabs are client state, so every
 * string it shows is produced once, in Node, and handed over finished. Nothing
 * here is derived from ICU or from the reader's clock (LESSONS §3a) — a
 * relative time rendered on both sides of a hydration boundary is a mismatch
 * React answers by throwing the tree away.
 *
 * The types are also a statement about what this panel may know. A line carries
 * a sentence, a time, a kind and — on a crew join — the joiner's display name
 * and avatar. There is no rider id, no handle, no email and no plan, because
 * that is the payload the server builds and a wider type here would be an
 * invitation to widen it (plan §3 guarantee 1).
 */

export interface WhatsNewLineView {
  readonly id: string;
  readonly kind: WhatsNewKind;
  /** The sentence, written by the product. Never text a rider typed (§6.1). */
  readonly line: string;
  /**
   * The `.lab` beside the sentence: "2 days ago" for something that happened,
   * and nothing at all for something still to come — its own sentence already
   * says when, and "6 days ago" beside "Corby Jam is Saturday" would be a true
   * timestamp describing the wrong thing.
   */
  readonly when: string | null;
  /** The second `.lab`: which part of the product this line came out of. */
  readonly source: string;
  /** A joiner's display name, for the row's avatar. Crew joins only. */
  readonly riderName: string | null;
  readonly avatarKey: string | null;
  /** A sticker's colour, for the row's disc. A catalogue fact. */
  readonly hue: string | null;
}

/** One crew's tab: the existing crew activity feed, unchanged. */
export interface WhatsNewCrewView {
  readonly id: string;
  readonly name: string;
  readonly items: readonly WhatsNewCrewItemView[];
  /** Set when the feed would not load, so the tab can say so. */
  readonly problem: string | null;
}

export interface WhatsNewCrewItemView {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly avatarKey: string | null;
  readonly line: string;
  readonly when: string;
  readonly sport: SportLook | null;
  readonly hue: string | null;
}

export interface WhatsNewView {
  /** The You tab, newest first. */
  readonly lines: readonly WhatsNewLineView[];
  /** One tab per crew, in the order the crew screen lists them. */
  readonly crews: readonly WhatsNewCrewView[];
  /**
   * How many You lines are newer than `users.whats_new_seen_at`.
   *
   * **The You lines only** — see `loadWhatsNew` for why the crew tabs do not
   * feed the badge.
   */
  readonly unread: number;
  /**
   * Did the read succeed? The panel stamps the rider's bookmark on open, and a
   * bookmark must never move past a list that failed to load (review N5).
   */
  readonly ok: boolean;
}

/** What the desktop dropdown shows before "All →" (rethink §3.6). */
export const WHATS_NEW_DROPDOWN_LINES = 8;
