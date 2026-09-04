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

/** The three sports Land The Trick tracks (plan §1). */
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
   * it. Land The Trick's `flat` holds bunny hops, manuals and x-ups; Flatland proper —
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
  /**
   * A trick a guardian should know about, marked per trick rather than
   * inferred from difficulty (T27).
   *
   * The line: the rider goes upside down (a flip or an invert), commits to a
   * drop they cannot step out of, or the trick's own tips send them to a foam
   * pit or a resi ramp first. It is deliberately not a difficulty flag — a
   * difficulty-2 drop-in carries one and several difficulty-5 flatground
   * tricks do not.
   *
   * Absent means no. `supervisedTricks()` in `../rules/crew.ts` still draws
   * the coach view's line off `SUPERVISED_MIN_DIFF`; moving it onto this field
   * is a separate task, which is why both exist.
   */
  readonly supervise?: boolean;
  /** Hidden tricks stay in the database but out of the library. */
  readonly isLive: boolean;
}

/* ---------------------------------------------------------------- stickers */

/**
 * The rule kinds an award-era sticker record may carry (T24). The *kind* is
 * code — a client or a staff edit cannot invent a new one — while the record
 * carries the tunable parameters (`n`, `trick`, `cat`), keeping plan §3's
 * split: rules in code, thresholds in data.
 *
 * Every kind is monotonic in the rider's own riding (issue #78): counts and
 * thresholds only, never "all of the category". `comeback` is transition-based
 * and awarded by a dedicated hook, so its generic rule is never-true; a kind
 * of `''` (promoter) is a record deliberately shipped without a rule.
 */
export type AwardKind =
  | 'trick'
  | 'landed-count'
  | 'sport-landed-count'
  | 'mastered-count'
  | 'hard-mastered'
  | 'sport-cat-count'
  | 'streak'
  | 'challenges'
  | 'clips'
  | 'spots-approved'
  | 'events-going'
  | 'crew'
  | 'crew-owned'
  | 'sports-landed'
  | 'sport-cats-landed'
  | 'profile-complete'
  | 'account-age'
  | 'founder'
  | 'stage-drop'
  | 'comeback'
  | 'supporter';

/** How rare an award reads on the wall. Display only — never gates anything. */
export type AwardRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

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
  /**
   * Award-era art (T24): a file under `packages/ui-web/assets/stickers/`. A record
   * with `img` renders the printed badge; one without keeps the drawn SVG,
   * which is what the retired legacy stickers still use.
   */
  readonly img?: string;
  /** 0–3 stars, baked into the art; carried for detail copy and sorting. */
  readonly stars?: number;
  /** Which coded rule judges this record. Absent on legacy slug-keyed rules. */
  readonly kind?: AwardKind | '';
  /** For `kind: 'trick'` — the trick slug this award celebrates. */
  readonly trick?: string;
  /** For `kind: 'sport-cat-count'` — the category the count reads. */
  readonly cat?: CategoryId;
  readonly rarity?: AwardRarity;
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
   * **Dormant.** Was the clip-vault size in bytes. Clip hosting was reversed by
   * the owner on 2026-08-17 (plan §1, §6.6) and nothing enforces this number any
   * more — it survives only because `listPlans` orders the plan cards by
   * `plans.clip_cap_bytes`. Never render it, and never treat it as a grant.
   */
  readonly clipCapBytes: number;
  /** Whether the plan unlocks the Spicy/Gnarly/Pro tiers. */
  readonly unlocksPaidTricks: boolean;
  /**
   * Whether the plan includes the progress insights panel (plan §2.4 — a Legend
   * perk).
   *
   * On the plan record for the same reason the paid-trick entitlement is:
   * entitlements resolve from our own data, staff can tune
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
  /**
   * How many **video links** this plan buys (plan §6.6, owner's decision
   * 2026-08-17). `0` means none, and means it unambiguously — see
   * `videoLinkAllowance` in `rules/video.ts` for why the allowance is a count
   * plus a boolean rather than one number with a sentinel in it.
   *
   * Read from the `plans` record by `pocketbase/hooks/45_video_links.pb.js`
   * before the write commits, like the paywall and the insights entitlement
   * before it, so the number is staff-tunable without a deploy and a missing
   * plan record grants nothing.
   */
  readonly videoLinkCap: number;
  /** Whether the cap above does not apply at all. Legend's, at launch. */
  readonly videoLinksUnlimited: boolean;
}

/* ------------------------------------------------------------ video links */

/**
 * Per-video visibility (plan §3 guarantee 2). **Two states, not three** — a
 * rider-supplied video is never `public`, so a signed-out visitor can never
 * reach one. Owner's decision (Rachid, 2026-08-17, in chat).
 *
 * Deliberately a separate union from `PrivacyId` rather than a narrowing of it:
 * they are different decisions about different things, and a shared type would
 * invite a component to hand a profile's `public` to a video's setter.
 */
export type VideoVisibilityId = 'private' | 'members';

/**
 * What a plan grants. See `videoLinkAllowance` for the encoding and why `0` and
 * "unlimited" are two fields.
 */
export interface VideoLinkAllowance {
  /** Maximum links, where `0` means none. Ignored when `unlimited` is true. */
  readonly cap: number;
  readonly unlimited: boolean;
}

/**
 * One rider's video link, as the surfaces render it.
 *
 * `videoId` is always the 11-character YouTube id — never a URL. The hook parses
 * whatever a rider pasted and stores only the id, so nothing downstream is ever
 * holding an attacker-controlled query string, fragment or redirect (plan §3
 * guarantee 2).
 */
export interface VideoLink {
  readonly id: string;
  readonly videoId: string;
  /** The trick this video hangs off, or `null` for one added outside a trick. */
  readonly trickId: string | null;
  readonly visibility: VideoVisibilityId;
  /** ISO date string as PocketBase returns it, or `''`. */
  readonly at: string;
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
  /*
   * Where the place actually is, and how to ask it a question. All three are
   * optional and most spots have fewer than three: a commercial indoor park
   * publishes an address and a number, a council concrete park usually an
   * address alone, a street spot neither, and a rider-submitted spot none of
   * them — the form does not ask. Readers render what is there rather than
   * printing an empty label. `country` is the common English name, displayed
   * as-is; it is a field of its own rather than the tail of `town` because the
   * seed's natural key is name-plus-town, and rewriting a town to append a
   * country would insert a second copy of every spot already in a database.
   */
  readonly address?: string;
  readonly phone?: string;
  readonly country?: string;
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
  /**
   * Where it is, beyond the town, and where the listing came from.
   *
   * All optional and all absent-by-default: an event is researched from an
   * organiser's page, and those pages publish wildly different amounts. A
   * commercial park's comp has every field; a council holiday clinic has an
   * address and a booking link and no phone; a jam has a name, a date and a
   * post. A reader renders each of these only when it is there
   * (`pocketbase/migrations/1787616000_event_location_and_source.js`).
   */
  /** The country's common English name — "USA", "New Zealand" — never a code. */
  readonly country?: string;
  /** Full postal address on one line, as the venue publishes it. */
  readonly address?: string;
  /** As the venue publishes it, international format, never parsed. */
  readonly phone?: string;
  /** The organiser's own page for this event: the receipt for the listing. */
  readonly sourceUrl?: string;
  /** The venue's point, for "Near me". Absent, or `0`, means "nowhere plotted". */
  readonly lat?: number;
  readonly lng?: number;
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
  /**
   * Rows in the `clips` collection for this rider.
   *
   * **Always zero since 2026-08-17**, when the owner reversed clip hosting
   * (plan §1, §6.6): there is no upload, and the collection's `createRule` is
   * `null`. It is kept because the `first-clip` sticker rule reads it and
   * `t15b-video-links` is the task that gives it values again. Nothing should
   * put this number on a screen until then.
   */
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
  /** Tricks at `every` AND difficulty 5 — consistency on a Pro trick (T24). */
  readonly hardMastered?: number;
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

  /*
   * Award-era shared stats (T24). All optional: the client computes the ones it
   * can from the snapshot it holds; the award hook computes every one of them
   * fresh from the database. A missing value reads as zero/false in the rules,
   * so the client can never show an instant award the server would refuse —
   * the wall is drawn from `rider_stickers` either way.
   */
  /** Spots this rider submitted that staff approved onto the map. */
  readonly spotsApproved?: number;
  /** Events this rider has marked "I'm going" on. Intent, never attendance. */
  readonly eventsGoing?: number;
  /** Members in the largest crew this rider owns. */
  readonly crewOwnedSize?: number;
  /** Avatar, level, goal, stance and at least one sport all set. */
  readonly profileComplete?: boolean;
  readonly accountAgeDays?: number;
  /** Joined during the launch window — see `FOUNDER_JOINED_BY`. */
  readonly isFounder?: boolean;
  /** On a paid plan right now. Server-resolved; the client never computes it. */
  readonly planPaid?: boolean;
  /** Has ever moved a trick *down* a stage — the honesty the stages ask for. */
  readonly stageDropped?: boolean;
  /** Sports with at least one landed trick. `bothSports` is `>= 2` of this. */
  readonly sportsLanded?: number;
  /** The largest single-sport landed count. */
  readonly maxSportLanded?: number;
  /** Per category, the largest single-sport landed count. */
  readonly maxSportCatCount?: Readonly<Record<CategoryId, number>>;
  /** The most categories any one sport has a landed trick in. */
  readonly maxSportCatsLanded?: number;
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
