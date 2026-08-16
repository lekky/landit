import type { SportId } from '@landit/core';
import type { CategoryLook, SportLook, StageLook } from '@landit/ui-web';

/**
 * What the server hands the Home screen.
 *
 * Everything the client renders is in here as plain data, and that is the
 * point. `HomeScreen` is a client component because the sport tabs are client
 * state, so every string it shows renders twice — once on the server and once
 * in the browser. Anything derived from the runtime rather than from data can
 * differ between those two, and a hydration mismatch does not merely warn: React
 * throws the client tree away, which in T6's sign-up form meant wiping what a
 * child had typed (LESSONS §3a).
 *
 * So the dates are formatted here, the numbers are computed here, and the
 * client's only job is to pick which sport's block to draw.
 */

/** One trick, ready for `TrickCard`. */
export interface TrickCardView {
  readonly slug: string;
  readonly name: string;
  readonly category: CategoryLook;
  readonly difficulty: number;
  readonly sport: SportLook;
  readonly stage: StageLook | null;
  readonly locked: boolean;
  readonly lockTier?: string;
}

export interface ChallengeView {
  readonly id: string;
  readonly week: string;
  readonly title: string;
  readonly blurb: string;
  readonly hue: string;
  readonly logged: number;
  readonly goal: number;
  readonly pct: number;
  /** "Scooter" while it runs, "Starts 24 Aug" before it does. */
  readonly stateLabel: string;
}

export interface AnnouncementView {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly label: string;
  readonly hue: string;
}

export interface StickerView {
  readonly id: string;
  readonly name: string;
  readonly hue: string;
  readonly icon?: string;
}

export interface CrewRiderView {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly avatarKey: string;
  readonly landed: number;
  readonly isMe: boolean;
}

/** The streak card, already reconciled against the rider's own week. */
export interface StreakView {
  /** "5 weeks" — never "5 days". The unit changed on 2026-08-16 (plan §1). */
  readonly headline: string;
  /** "1 of 2 rides this week". */
  readonly progressLabel: string;
  /** Gain-framed, always (plan §6.4, Standard 13). */
  readonly encouragement: string;
  /** One cell per ride the week needs; `true` for the ones already made. */
  readonly cells: readonly boolean[];
  /** Rides past the target, shown as a `+N` chip rather than more cells. */
  readonly spare: number;
  /** Whether "I rode today" has already been tapped today, in the rider's zone. */
  readonly rodeToday: boolean;
}

/** Everything that changes when the rider switches sport tab. */
export interface SportView {
  readonly sport: SportId;
  readonly landed: number;
  readonly working: number;
  readonly wanted: number;
  readonly total: number;
  readonly pct: number;
  readonly stickerCount: number;
  readonly libraryLabel: string;
  readonly summary: string;
  /** "6 landed across your sports", or nothing when there is only one. */
  readonly acrossSports: string | null;
  readonly workingTricks: readonly TrickCardView[];
  readonly startHere: readonly TrickCardView[];
  readonly wishList: readonly TrickCardView[];
  readonly challenge: ChallengeView | null;
  readonly announcement: AnnouncementView | null;
}

export interface HomeView {
  readonly firstName: string;
  /** "Saturday 15 August", built from a table rather than from ICU. */
  readonly dateLabel: string;
  readonly streak: StreakView;
  readonly stickers: readonly StickerView[];
  readonly crew: readonly CrewRiderView[];
  readonly bySport: Readonly<Record<string, SportView>>;
  readonly sports: readonly SportId[];
}
