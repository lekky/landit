/**
 * Shared types for `@landit/core`.
 *
 * These describe the *records* the product is made of — tricks, stickers,
 * plans, challenges — and the rider-shaped inputs the rules take. They are
 * deliberately structural and free of any storage concern: a PocketBase row, a
 * seed literal and a test fixture all satisfy the same shape, which is what
 * lets one set of rules run in the browser, in a PocketBase hook and (later)
 * in the native app.
 */

/* ------------------------------------------------------------------ sports */

/** The three sports Land It tracks (plan §1). */
export type SportId = 'scooter' | 'skate' | 'bmx';

/** Presentation and copy for one sport. */
export interface Sport {
  readonly id: SportId;
  readonly label: string;
  readonly short: string;
  /** Hex colour. Scooter is orange, skate is blue, BMX is pink. */
  readonly color: string;
  /** Key into the icon map in `@landit/ui-web`. */
  readonly icon: string;
  /** "What you need" copy on a trick page. */
  readonly kit: string;
  readonly blurb: string;
  /**
   * Category labels this sport overrides.
   *
   * The category *ids* are shared across every sport and always will be — the
   * stats, the stickers and the skill tree all key off them. What a rider is
   * shown is another matter: `flat` reads as "flatground" to a scooter or skate
   * rider, but **Flatland is one of BMX's five named disciplines**, so the bare
   * word means something specific and different to the audience it is aimed at.
   * Only the display string moves; nothing keyed off the id changes.
   *
   * BMX shows **"Flatground"**, which is the point worth keeping when this is
   * next edited: it is not a synonym for Flatland but a deliberate avoidance of
   * it. Land It's `flat` holds bunny hops, manuals and x-ups; Flatland proper —
   * hang-5, time machine, steamroller — is a separate discipline on a different
   * bike, and the library does not contain it. "Flat" under-specifies and
   * "Flatland" over-promises; only the longer word is honest to both readers.
   */
  readonly categoryLabels?: Partial<Record<CategoryId, string>>;
}

/* -------------------------------------------------------------- categories */

/** Trick categories. Each has its own colour, used on cards and the skill tree. */
export type CategoryId = 'flat' | 'street' | 'park' | 'hybrid' | 'air';

export interface Category {
  readonly id: CategoryId;
  readonly label: string;
  readonly color: string;
  readonly blurb: string;
}

/* ------------------------------------------------------------------ stages */

/**
 * The five honesty-based stages, in order. A trick counts as *landed* from
 * `some` upward — see `isLandedStage`.
 */
export type StageId = 'want' | 'trying' | 'some' | 'most' | 'every';

/** The stages that count as landed. */
export type LandedStageId = Extract<StageId, 'some' | 'most' | 'every'>;

export interface Stage {
  readonly id: StageId;
  readonly label: string;
  readonly short: string;
  readonly color: string;
  /** Where the stage sits on a progress bar, 0–100. */
  readonly pct: number;
}

/* ------------------------------------------------------------------ tricks */

/** Difficulty, 1 (Rookie) to 5 (Pro). */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Trick {
  readonly id: string;
  readonly name: string;
  readonly sport: SportId;
  readonly cat: CategoryId;
  readonly diff: Difficulty;
  /** Prerequisite trick ids. Never crosses sports. */
  readonly pre: readonly string[];
  readonly about: string;
  readonly tips: string;
  readonly fact: string;
  /**
   * Staff override for the free/paid split. When absent, a trick is free at
   * `diff <= FREE_MAX_DIFF`. Setting it either way wins over difficulty.
   */
  readonly free?: boolean;
  /** Hidden tricks stay in the database but out of the library. */
  readonly isLive: boolean;
}

/* ---------------------------------------------------------------- stickers */

export interface Sticker {
  readonly id: string;
  readonly name: string;
  /** `null` judges the sticker against the rider's combined stats. */
  readonly sport: SportId | null;
  readonly hue: string;
  /** Key into the icon map in `@landit/ui-web`. */
  readonly ico: string;
  /** Condition copy. Reads after `n` when a threshold is set: "5 tricks landed". */
  readonly cond: string;
  /** Editable threshold. Rules read it from the record, never from a literal. */
  readonly n?: number;
  readonly isLive: boolean;
}

/**
 * A sticker's condition, as a pure predicate over the rider's stats.
 *
 * The scope passed in is already resolved: sport-scoped stickers get that
 * sport's stats, combined stickers get the rider's global stats.
 */
export type StickerRule = (scope: SportStats, sticker: Sticker) => boolean;

/* ------------------------------------------------------------------- plans */

/** Plan ids (plan §2.4). The Crew Pass was dropped; Legend replaced it. */
export type PlanId = 'rookie' | 'shredder' | 'legend';

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  readonly hue: string;
  readonly pitch: string;
  readonly perks: readonly string[];
  /** What this plan does *not* include. Rendered struck through. */
  readonly missing: readonly string[];
  /** The raised "Most riders" card. */
  readonly popular?: boolean;
  /** Price in pence so money is never a float. Zero on Rookie. */
  readonly priceMonthlyPence: number;
  readonly priceYearlyPence: number;
  /**
   * Clip vault size in bytes; zero means clips cannot be saved at all. Read
   * from the plan record so staff can tune it without a deploy (plan §6).
   */
  readonly clipCapBytes: number;
  /** Whether the plan unlocks the Spicy/Gnarly/Pro tiers. */
  readonly unlocksPaidTricks: boolean;
  /**
   * Whether the plan includes the progress insights panel (plan §2.4 — a Legend
   * perk).
   *
   * On the plan record for the same reason the clip cap and the paid-trick
   * entitlement are: entitlements resolve from our own data, staff can tune
   * them without a deploy, and a missing plan record fails closed. Being
   * entitled is only half of it — insights are profiling, so a rider must also
   * opt in (`users.insights_opt_in`, plan §6.4 standard 12).
   */
  readonly includesInsights: boolean;
  /**
   * Whether the plan carries **Legend flair** — the tag beside a rider's name
   * on their profile and on the crew board (plan §2.4).
   *
   * An entitlement on the plan record for the same reason as the two above, and
   * for one more that matters here: the crew board's payload is built
   * server-side from a fixed field list (§3 guarantee 1) and deliberately does
   * not carry a rider's plan. What crosses to another rider is this boolean,
   * already resolved — never the plan a rider is on.
   *
   * Cosmetic and only ever cosmetic. Plan §2.4: achievements are never for
   * sale, so flair may decorate a name and may never change a score, a stage,
   * a sticker or a place on the board.
   */
  readonly includesFlair: boolean;
}

/* -------------------------------------------------------------- challenges */

/** Derived from `starts`/`ends`, never stored (plan §2.2). */
export type ChallengeState = 'upcoming' | 'live' | 'past';

export interface Challenge {
  readonly id: string;
  readonly sport: SportId;
  readonly week: string;
  readonly title: string;
  readonly blurb: string;
  /** Inclusive first day, `YYYY-MM-DD`. */
  readonly starts: string;
  /** Inclusive last day, `YYYY-MM-DD`. */
  readonly ends: string;
  /** How many logs finish it. */
  readonly goal: number;
  readonly reward: string;
  readonly hue: string;
  /** Display copy ("1,102 riders in"), not a count. */
  readonly riders: string;
  readonly verb: string;
  readonly isLive: boolean;
}

/* ------------------------------------------------------------- spots, etc. */

/** Rider submissions arrive `pending` and are approved by staff (plan §3). */
export type SpotStatus = 'pending' | 'live' | 'rejected';

export interface Spot {
  readonly name: string;
  readonly town: string;
  readonly type: string;
  readonly lat: number;
  readonly lng: number;
  readonly sports: readonly SportId[];
  readonly tags: readonly string[];
  readonly status: SpotStatus;
}

/** A plain coordinate pair. */
export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export type EventKind = 'Comp' | 'Session' | 'Class' | 'Jam';

/** Named `LandItEvent` because `Event` is a DOM global. */
export interface LandItEvent {
  readonly id: string;
  readonly name: string;
  readonly kind: EventKind;
  readonly town: string;
  readonly venue: string;
  /** Calendar day, `YYYY-MM-DD`. */
  readonly date: string;
  readonly sports: readonly SportId[];
  readonly level: string;
  readonly price: string;
  /** Display copy ("40 riders"), not a count. */
  readonly spots: string;
  readonly blurb: string;
  readonly isLive: boolean;
}

/* ------------------------------------------------------- rider profile bits */

export type StanceId = 'regular' | 'goofy' | 'switch';

export interface Stance {
  readonly id: StanceId;
  readonly label: string;
  readonly sub: string;
}

export type PrivacyId = 'public' | 'members' | 'private';

export interface Privacy {
  readonly id: PrivacyId;
  readonly label: string;
  readonly short: string;
  /** Copy shown to the rider about their own setting. */
  readonly blurb: string;
  /** Copy shown to someone else looking at this rider. */
  readonly other: string;
}

export type LevelId = 'new' | 'some' | 'solid' | 'send';

export interface Level {
  readonly id: LevelId;
  readonly label: string;
  readonly sub: string;
  readonly hue: string;
}

export interface Goal {
  readonly id: string;
  /** `null` offers the goal whatever the rider rides. */
  readonly sport: SportId | null;
  readonly label: string;
  readonly hue: string;
}

export interface Avatar {
  readonly id: string;
  readonly name: string;
  readonly group: string;
  /** Background colour behind the illustration. */
  readonly hue: string;
  /** Bare PNG filename; `@landit/ui-web` owns where it resolves to. */
  readonly file: string;
}

export interface AvatarGroup {
  readonly id: string;
  readonly blurb: string;
}

/* ------------------------------------------------------------ rider inputs */

/**
 * One row of `trick_log` (plan §3). Append-only: the app never edits one, but a
 * rider may delete their own, and every derived date recomputes from what
 * remains.
 */
export interface TrickLogEntry {
  /** The trick this entry is about. */
  readonly trick: string;
  readonly stage: StageId;
  /** When it happened, epoch milliseconds. */
  readonly at: number;
  /**
   * Backfilled rather than observed. The UI says so rather than pretending the
   * date is exact — the prototype's `est: true`.
   */
  readonly estimated?: boolean;
}

/**
 * Everything the rules need to know about one rider, in whatever form the
 * caller has it. A PocketBase hook assembles this from collections; the web
 * client assembles it from its cache; a test writes it by hand.
 */
export interface RiderSnapshot {
  /** `trick_progress` flattened: trick id to its current stage. */
  readonly byId: Readonly<Record<string, StageId>>;
  /** Which sports the rider tracks. Empty falls back to scooter. */
  readonly sports?: readonly SportId[];
  /**
   * The streak **as it stands now** — a value read straight out of
   * `users.streak` may be stale, so pass it through the streak rule first,
   * otherwise a streak sticker can be earned by a streak that already lapsed.
   *
   * **The unit changed and the sticker thresholds have not caught up.** The
   * streak counts *weeks* since 2026-08-16 (plan §1), so `currentWeeklyStreak`
   * is what fills this now — but the `week-one` and `month-on` sticker rules
   * still test it against 7 and 30, which under the new unit means 7 and 30
   * *weeks* while the sticker names say days. What those two stickers should
   * award is an owner decision, tracked as an issue; nothing here guesses at it.
   */
  readonly streak?: number;
  /** How many clips the rider has saved. */
  readonly clips?: number;
  /** Whether the rider is in a crew. */
  readonly crew?: boolean;
  /** Challenge id to how many logs the rider has against it. */
  readonly challengeLogged?: Readonly<Record<string, number>>;
}

/* ------------------------------------------------------------------- stats */

/** Stats for one scope: a single sport, or everything when `sport` is null. */
export interface SportStats {
  /** The sport this scope covers; `null` means combined. */
  readonly sport: SportId | null;
  readonly byId: Readonly<Record<string, StageId>>;
  /** Live tricks in scope. */
  readonly total: number;
  /** Tricks at any stage. */
  readonly tracked: number;
  readonly landed: number;
  readonly landedIds: readonly string[];
  /** Tricks at `trying`. */
  readonly working: number;
  /** Tricks at `want`. */
  readonly wanted: number;
  /** Tricks at `every`. */
  readonly mastered: number;
  /** Landed tricks at difficulty 5. */
  readonly hardLanded: number;
  readonly catCount: Readonly<Record<CategoryId, number>>;
  readonly catTotal: Readonly<Record<CategoryId, number>>;
  /** Whether every trick in the category is landed. False for an empty category. */
  readonly catDone: Readonly<Record<CategoryId, boolean>>;
  readonly streak: number;
  readonly clips: number;
  /** Challenges finished in scope. */
  readonly challenges: number;
  readonly crew: boolean;
  /**
   * Whether the rider has landed something on **two or more** sports.
   *
   * It was `SPORT_IDS.every(...)` while there were two sports, where "every"
   * and "at least two" are the same sentence. Adding BMX (T21) split them, and
   * `every` would have silently redefined the `both-feet` sticker as *all
   * three* — un-earning it for every rider who had it, without touching the
   * sticker, its name or its copy. That is LESSONS §4 exactly: when a rule's
   * basis changes, the data quoting it changes meaning for free.
   *
   * "At least two" keeps what riders already earned. Whether a separate
   * all-three sticker should exist is a product question, not this function's.
   */
  readonly bothSports: boolean;
  /** Landed as a percentage of tricks in scope, rounded. */
  readonly pct: number;
}

/**
 * A rider's stats at every scope at once: the selected sport at the top level,
 * each sport under `bySport`, and the combined totals under `global`.
 */
export interface RiderStats extends SportStats {
  readonly sports: readonly SportId[];
  readonly bySport: Readonly<Record<SportId, SportStats>>;
  readonly global: SportStats;
}

/* -------------------------------------------------------------------- time */

/**
 * A calendar day in the rider's own timezone, `YYYY-MM-DD`.
 *
 * Streaks, "rode today" and challenge boundaries are all day comparisons, and
 * a day only means something inside a timezone — hence `users.timezone`
 * (plan §3).
 */
export type DayKey = string;

/** An instant, however the caller happens to hold one. */
export type Instant = Date | number | string;
