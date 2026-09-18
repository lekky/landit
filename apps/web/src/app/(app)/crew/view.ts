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
  /**
   * The rider's weekly streak. No longer drawn on the board (2026-09-13) but
   * still on the payload, because the field is theirs and Home reads it.
   */
  readonly streak: number;
  /**
   * Sessions this rider logged **this month** — the board's own window, and
   * what replaced the weeks column.
   *
   * All of them, whatever each session's visibility, exactly as `landed`
   * counts every landed trick whatever the rider's privacy: plan §3 guarantee
   * 1's "by name and score" is the licence and the limit. It is a number and
   * it opens nothing; the feed beside it applies the per-session test.
   */
  readonly sessions: number;
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
  /**
   * How many crews this rider's plan may create, and what that plan is called
   * (owner, 2026-09-17: "1 for free, 3 for 3.99 and 10 for the top tier").
   *
   * Read off the `plans` record rather than a constant, like every other
   * entitlement (plan §2.4): staff can move the number without a deploy, and
   * the screen cannot disagree with the hook that enforces it.
   */
  readonly crewCap: number;
  readonly planName: string;
  /** `null` while a rider has no handle, which makes their profile unlinkable. */
  readonly handle: string | null;
  /** "Scooter, skateboard and BMX" — generated from `SPORT_IDS`, never a pair. */
  readonly sportsLine: string;
  /** A rider waiting on a guardian cannot be in a crew at all (guarantee 4). */
  readonly consentLimited: boolean;
  readonly crews: readonly CrewSummaryView[];
  readonly selected: SelectedCrewView | null;
}
