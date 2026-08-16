import type { SportLook } from '@landit/ui-web';

/**
 * Everything the crew screen renders, computed on the server.
 *
 * Same shape of split as Home's `view.ts` and for the same reason: the page is
 * a client component only because the invite share card is, so every string it
 * shows is produced once, in Node, and handed over finished. Nothing on this
 * screen is derived from ICU or from the reader's clock (LESSONS §3a).
 *
 * The types below are also a statement about what a crew screen may know. There
 * is no email on a board row and no plan on one — only `flair`, already
 * resolved — because that is the fixed payload the server route builds
 * (plan §3 guarantee 1), and a wider view type here would be an invitation to
 * widen the route.
 */

export interface BoardRowView {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly avatarKey: string | null;
  readonly sports: readonly SportLook[];
  readonly streak: number;
  readonly landed: number;
  readonly isMe: boolean;
  readonly isOwner: boolean;
  /** Legend flair (plan §2.4). Cosmetic; it moves nobody up the board. */
  readonly flair: boolean;
}

export interface FeedItemView {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly avatarKey: string | null;
  /** The sentence, written by the product. Never text a rider typed (§6.1). */
  readonly line: string;
  readonly when: string;
  readonly sport: SportLook | null;
  readonly hue: string | null;
}

export interface CrewSummaryView {
  readonly id: string;
  readonly name: string;
  /** The rider's own membership row, so leaving is a one-line form. */
  readonly membershipId: string | null;
  readonly isOwner: boolean;
}

export interface SelectedCrewView extends CrewSummaryView {
  readonly memberCount: number;
  readonly board: readonly BoardRowView[];
  readonly feed: readonly FeedItemView[];
  /** Set when the board or the feed would not load, so the panel can say so. */
  readonly problem: string | null;
}

export interface CrewView {
  readonly firstName: string;
  /** `null` while a rider has no handle, which makes their profile unlinkable. */
  readonly handle: string | null;
  /** "Scooter, skateboard and BMX" — generated from `SPORT_IDS`, never a pair. */
  readonly sportsLine: string;
  /** A rider waiting on a guardian cannot be in a crew at all (guarantee 4). */
  readonly consentLimited: boolean;
  readonly crews: readonly CrewSummaryView[];
  readonly selected: SelectedCrewView | null;
}
