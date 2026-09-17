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
  /**
   * The `tricks` **record** id, which is what `trick_progress` relates to.
   *
   * Everything else on this screen is keyed by slug, because a slug survives a
   * reseed and a record id does not. This is here because "Working on it" can
   * now set a stage without opening the trick, and a write needs the id the
   * relation actually stores. Absent when the record is not to hand, and the
   * inline stage row simply does not render — the card still opens the trick,
   * which is where the picker has always been.
   */
  readonly recordId?: string;
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
  /**
   * "Ends Sunday" — the Challenge card's sub-line (§3.4).
   *
   * A weekday rather than a date because the window is a week and the card has
   * one line: "Ends Sunday" is a thing a rider can act on, where "ends 30 Aug"
   * has to be worked out. It is **not** a countdown and never says what is
   * about to be lost (plan §6.4, Standard 13) — a week that has not started
   * says when it does, and a finished one says so in the past tense.
   */
  readonly endsLabel: string;
}

export interface AnnouncementView {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly label: string;
  readonly hue: string;
}

/**
 * One line of a crew's activity, as Home shows it (§3.4).
 *
 * Home used to draw the crew **board** — a ranked table of names and landed
 * counts. The rethink puts the activity feed there instead, because the board
 * is what `/crew` is for and a dashboard wants "what happened" rather than
 * "who is ahead". Three lines, and the rest is one tap away.
 *
 * `line` is written by `crewActivityLine` in `@landit/core`, so the whole
 * vocabulary of this panel is six unit-tested sentences the product wrote.
 * Nothing a rider typed reaches it, which is what keeps "no rider-to-rider
 * messaging" (plan §6.1) true of the shapes and not merely of the intent.
 */
export interface CrewLineView {
  readonly id: string;
  /** The sentence, from `crewActivityLine`. */
  readonly line: string;
  /** "2h ago", already relative on the server. */
  readonly when: string;
  readonly name: string;
  readonly avatarKey: string;
}

/**
 * The next event this rider said they are going to (§3.4, "Next up").
 *
 * Their own `event_attendance`, which is `OWN` — nobody else's attendance is on
 * this screen or reachable from it. `null` when there is nothing ahead, and the
 * section then invites them to go and find one rather than drawing an empty box.
 */
export interface NextEventView {
  readonly slug: string;
  readonly name: string;
  /** "Saturday 15 August" — the same table-driven form the greeting uses. */
  readonly dateLabel: string;
  readonly town: string;
  /** The event kind's colour, so the card reads as the same thing `/events` drew. */
  readonly hue: string;
}

/** One of the rider's favourite spots (§3.4, "Your spots"). */
export interface FaveSpotView {
  readonly slug: string;
  readonly name: string;
  readonly town: string;
}

/**
 * The Sessions card's two numbers (§3.4).
 *
 * `null` for everybody the sessions preview is not open to (plan §7, T41) — and
 * when it is null the card is not drawn at all, which is also why the two extra
 * reads it needs are not made. A dashboard should not pay for a card nobody
 * sees.
 */
export interface SessionsCardView {
  /** Sessions ridden in the rider's own current month. */
  readonly value: string;
  /** "Corby Ramps · 14 Sep", or an invitation when there are none yet. */
  readonly sub: string;
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
  /**
   * Stickers earned on **this sport's wall** — its own plus the shared ones,
   * the scope `/stickers` uses for "<sport> and shared".
   *
   * It is scoped because it sits in a `SportView`: a card that counted every
   * wall told a rider chipped to scooter that they had one sticker and then
   * opened an empty scooter wall.
   */
  readonly stickerCount: number;
  /** The newest of those, by `earned_at`, for the card's sub-line. `null` at zero. */
  readonly newestSticker: string | null;
  readonly libraryLabel: string;
  readonly summary: string;
  /** "6 landed across your sports", or nothing when there is only one. */
  readonly acrossSports: string | null;
  /**
   * How many of this sport's tricks the rider has a stage on — every stage,
   * not just the ones in progress. It is the number on the way into "My
   * tricks", so it has to match what that screen then shows.
   */
  readonly tracked: number;
  /**
   * Up to four, and the phone shows the first two (§3.4).
   *
   * Four rather than two so the cut is CSS at the 860px line rather than a
   * width measured in JavaScript: a number decided in the browser is a number
   * the server guessed differently, and a dashboard that renders one grid on
   * the server and another on hydration is the mismatch LESSONS §3a is about.
   */
  readonly workingTricks: readonly TrickCardView[];
  readonly startHere: readonly TrickCardView[];
  readonly challenge: ChallengeView | null;
  readonly announcement: AnnouncementView | null;
}

export interface HomeView {
  readonly firstName: string;
  /**
   * Whether this rider can reach the session logger (plan §7, T41 — sessions
   * are in owner-only preview). The server answers `sessionsEnabledFor` once,
   * here, because `HomeScreen` is a client component and `process.env` is not
   * its to read: a gate evaluated in the browser is a gate.
   *
   * False is the ordinary case today, and Home renders exactly as it did before
   * T43 — one yellow "I rode today" and nothing else.
   */
  readonly sessionsEnabled: boolean;
  /** "Saturday 15 August", built from a table rather than from ICU. */
  readonly dateLabel: string;
  readonly streak: StreakView;
  /*
   * The newest sticker is a name rather than the four badges the wall used to
   * draw here: the card carries the count, the wall carries the collection, and
   * a dashboard row of art that repeats what is one tap away is a row that costs
   * a phone screen for nothing. It lives on `SportView` rather than here,
   * because the card follows the chip.
   */
  /** The Sessions card, or `null` when the preview is not open to this rider. */
  readonly sessionsCard: SessionsCardView | null;
  /** Three lines of the rider's first crew's feed, newest first. */
  readonly crewActivity: readonly CrewLineView[];
  readonly nextEvent: NextEventView | null;
  readonly faveSpots: readonly FaveSpotView[];
  readonly bySport: Readonly<Record<string, SportView>>;
  readonly sports: readonly SportId[];
}
