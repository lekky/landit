import { TIERS_LABEL } from '../data/categories';
import { CROSS_SPORT } from '../data/cross-sport';
import { LANDED_STAGES } from '../data/stages';
import { SPORT_IDS } from '../data/sports';
import { TRICKS } from '../data/tricks';
import { PLAN } from '../data/plans';
import type {
  CategoryId,
  Difficulty,
  PlanId,
  SportId,
  StageId,
  Trick,
  TrickMistake,
} from '../types';

/**
 * The free/paid cut-off. A trick with no `free` override is free at this
 * difficulty or below — currently the Rookie and Easy tiers.
 *
 * Staff move an individual trick across the line with the `free` field rather
 * than by moving this number; changing it re-tiers the whole library at once.
 */
export const FREE_MAX_DIFF = 2;

/**
 * Every function here takes an optional trick list. It defaults to the
 * canonical library, which is what the client wants; a PocketBase hook passes
 * the live rows instead, so staff edits take effect without a deploy.
 */
type TrickList = readonly Trick[];

/** Is this stage one that counts as landed? `some`, `most` or `every`. */
export function isLandedStage(stage: StageId | null | undefined): boolean {
  return stage != null && (LANDED_STAGES as readonly string[]).includes(stage);
}

/** Is this trick landed, given the rider's stage map? */
export function isTrickLanded(byId: Readonly<Record<string, StageId>>, trickId: string): boolean {
  return isLandedStage(byId[trickId]);
}

/** Look a trick up by id. Returns `undefined` rather than throwing. */
export function trickById(id: string, tricks: TrickList = TRICKS): Trick | undefined {
  return tricks.find((t) => t.id === id);
}

/** Which sport a trick belongs to, or `undefined` if the id is unknown. */
export function sportOf(id: string, tricks: TrickList = TRICKS): SportId | undefined {
  return trickById(id, tricks)?.sport;
}

/**
 * The tricks in scope. Pass `null` or nothing for everything the rider could
 * possibly track.
 */
export function tricksFor(sport?: SportId | null, tricks: TrickList = TRICKS): Trick[] {
  return sport ? tricks.filter((t) => t.sport === sport) : [...tricks];
}

/** Tricks in one category, optionally narrowed to a sport. */
export function tricksInCategory(
  cat: CategoryId,
  sport?: SportId | null,
  tricks: TrickList = TRICKS,
): Trick[] {
  return tricksFor(sport, tricks).filter((t) => t.cat === cat);
}

/**
 * Is this trick on the free tier?
 *
 * The `free` field is a staff override and wins either way — it can pull a hard
 * trick into the free tier or push an easy one out of it. With no override, a
 * trick is free at `diff <= FREE_MAX_DIFF`.
 */
export function isTrickFree(trick: Trick): boolean {
  return trick.free === undefined ? trick.diff <= FREE_MAX_DIFF : trick.free;
}

/** Does this plan unlock the paid tiers? Read from the plan record, not hard-coded. */
export function planUnlocksPaidTricks(plan: PlanId): boolean {
  return PLAN[plan].unlocksPaidTricks;
}

/**
 * Is this trick behind the paywall for a rider on this plan?
 *
 * Locked tricks stay visible throughout — a rider is always told what they are
 * missing, never shown a shorter library. Enforcement is server-side: this
 * function is the definition, and the `trick_progress` create hook is where it
 * binds (plan §3, guarantee 3). A client-side check alone is a suggestion.
 */
export function isTrickLocked(trick: Trick, plan: PlanId): boolean {
  return !planUnlocksPaidTricks(plan) && !isTrickFree(trick);
}

/** Every trick a rider on this plan may open, track or film. */
export function openTricks(plan: PlanId, tricks: TrickList = TRICKS): Trick[] {
  return tricks.filter((t) => !isTrickLocked(t, plan));
}

/**
 * The prerequisites this rider has not landed yet. Empty means the trick is
 * unlocked.
 */
export function missingPrereqs(trick: Trick, byId: Readonly<Record<string, StageId>>): string[] {
  return trick.pre.filter((p) => !isTrickLanded(byId, p));
}

/**
 * Is this trick unlocked? True when **every** entry in `pre` is landed — and
 * trivially true for a trick with no prerequisites.
 *
 * This is separate from the paywall: a trick can be unlocked and still locked
 * behind a plan, and the skill tree draws those two states differently.
 */
export function isTrickUnlocked(trick: Trick, byId: Readonly<Record<string, StageId>>): boolean {
  return missingPrereqs(trick, byId).length === 0;
}

/**
 * Tricks this rider could start on now: not yet landed, every prerequisite
 * landed, and not behind their paywall. Feeds "Start here" and the Legend
 * next-trick suggestions.
 */
export function suggestedNextTricks(
  byId: Readonly<Record<string, StageId>>,
  plan: PlanId,
  sport?: SportId | null,
  tricks: TrickList = TRICKS,
): Trick[] {
  return tricksFor(sport, tricks).filter(
    (t) =>
      t.isLive && !isTrickLanded(byId, t.id) && isTrickUnlocked(t, byId) && !isTrickLocked(t, plan),
  );
}

/* ------------------------------------------------------------ cross-sport -- */

/**
 * The same movement in the other sports (T28): the live tricks `CROSS_SPORT`
 * pairs this one with, in sport order — scooter, skate, BMX — so a screen can
 * render them in the order the sport tabs use without sorting again.
 *
 * Read against the trick list handed in, not the map alone, so an equivalent
 * that staff have hidden drops out rather than rendering a link to nothing.
 * An id the map does not know returns an empty list.
 */
export function crossSportEquivalents(trickId: string, tricks: TrickList = TRICKS): Trick[] {
  const pairs = CROSS_SPORT[trickId];
  if (!pairs) return [];
  const out: Trick[] = [];
  for (const sport of SPORT_IDS) {
    const id = pairs[sport];
    if (!id) continue;
    const trick = trickById(id, tricks);
    if (trick && trick.isLive) out.push(trick);
  }
  return out;
}

/* ---------------------------------------------------------- trick content -- */

/**
 * The shape the researched per-trick content keeps to (T28): how many
 * mistakes a trick lists, and how long each part may be, in words.
 *
 * The limits are the definition; `trickContentProblems` below reads them, the
 * data tests pin the shipped library to them, and `pocketbase/hooks/lib/landit.js`
 * repeats the same numbers to refuse a staff edit that would break them —
 * the hook cannot import this package, so the two are held in step by the
 * PocketBase test suite rather than by a shared constant.
 */
export const TRICK_CONTENT_LIMITS = {
  /** A trick with any mistakes at all lists at least this many. */
  mistakesMin: 3,
  mistakesMax: 4,
  /** `what` is a heading: at most this many words, ending in a full stop. */
  whatMaxWords: 8,
  /** `fix` is one sentence of at most this many words. */
  fixMaxWords: 20,
  /** `hard` is one or two sentences of at most this many words. */
  hardMaxWords: 35,
} as const;

/** Words, as the limits count them: runs of non-space characters. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Everything wrong with a proposed `mistakes` list and `hard` line, in the
 * words a staff member would be shown. Empty means it may be saved.
 *
 * An empty list and an empty `hard` are both allowed — that is "not written
 * yet", the state a brand-new trick is in — but a list of one or two is not:
 * the section is a set of the common mistakes, and one item is a caption.
 */
export function trickContentProblems(
  mistakes: readonly TrickMistake[] | undefined,
  hard: string | undefined,
): string[] {
  const L = TRICK_CONTENT_LIMITS;
  const problems: string[] = [];
  const list = mistakes ?? [];

  if (list.length > 0 && (list.length < L.mistakesMin || list.length > L.mistakesMax)) {
    problems.push(`List ${L.mistakesMin} or ${L.mistakesMax} common mistakes, or none yet.`);
  }
  list.forEach((m, i) => {
    const n = i + 1;
    const what = m.what.trim();
    const fix = m.fix.trim();
    if (!what || !fix) {
      problems.push(`Mistake ${n} needs both the mistake and the fix.`);
      return;
    }
    if (wordCount(what) > L.whatMaxWords) {
      problems.push(`Mistake ${n}: keep "what" to ${L.whatMaxWords} words.`);
    }
    if (!what.endsWith('.')) {
      problems.push(`Mistake ${n}: end "what" with a full stop.`);
    }
    if (wordCount(fix) > L.fixMaxWords) {
      problems.push(`Mistake ${n}: keep the fix to ${L.fixMaxWords} words.`);
    }
  });

  if (hard && wordCount(hard) > L.hardMaxWords) {
    problems.push(`Keep "why it's this tier" to ${L.hardMaxWords} words.`);
  }

  return problems;
}

/* -------------------------------------------------- the trick page (T31) -- */

/**
 * One step on the road to a trick: the trick itself, and any prerequisite of
 * it that is not on the main line.
 *
 * The library's graph is, in practice, a set of chains — nearly every trick has
 * one prerequisite, and the few with two have a "main" one whose own chain is
 * the longer. A trick page draws that main line top to bottom and hangs the
 * other prerequisite off the step that needs it, which is what `also` is.
 */
export interface RoadStep {
  readonly trick: Trick;
  /** Prerequisites of this step that are not on the main line. Usually empty. */
  readonly also: readonly Trick[];
}

/**
 * The road to a trick: every step from the root of its prerequisite chain down
 * to the trick itself, in that order, the trick last.
 *
 * Where a step has more than one prerequisite the longest chain is the road and
 * the others are that step's `also` — one line to draw, and nothing lost. A
 * prerequisite already on the road (a diamond in the graph) is not repeated as
 * an `also`. Hidden and unknown prerequisites are dropped the way `prereqTricks`
 * drops them, and a cycle in the data — which would be a staff error, not a
 * shape the library has — is cut where it closes rather than followed forever.
 *
 * Reads only the catalogue: which of the steps a rider has landed, and which
 * are behind their paywall, are the page's questions to ask of `isTrickLanded`
 * and `isTrickLocked` per step.
 */
export function fullPrereqChain(trick: Trick, tricks: TrickList = TRICKS): RoadStep[] {
  const byId = new Map(tricks.map((t) => [t.id, t]));

  const walk = (step: Trick, path: ReadonlySet<string>): RoadStep[] => {
    const onPath = new Set(path);
    onPath.add(step.id);
    const parents = step.pre
      .map((id) => byId.get(id))
      .filter((p): p is Trick => !!p && p.isLive && !onPath.has(p.id));

    let road: RoadStep[] = [];
    let mainParent: Trick | null = null;
    for (const parent of parents) {
      const chain = walk(parent, onPath);
      // Strictly longer, so a tie goes to the prerequisite listed first.
      if (chain.length > road.length) {
        road = chain;
        mainParent = parent;
      }
    }

    const also = parents.filter((p) => p !== mainParent && !road.some((s) => s.trick.id === p.id));
    return [...road, { trick: step, also }];
  };

  return walk(trick, new Set());
}

/**
 * Where a trick sits in its library, as counts.
 *
 * Counts and not an ordinal (Rachid, 2026-09-07, in chat): the trick page's
 * design said "23 of 84 in the scooter library", which implies an order the
 * library does not have — nothing ranks one trick above another, and a number
 * that looked like a rank would be read as one. So this says how many tricks
 * share this one's shelf, how big the sport's library is, and which tier it is
 * on, and leaves it there.
 */
export interface TrickPositionFacts {
  /** Live tricks in the same sport, category and tier — this one included. */
  readonly peers: number;
  /** Live tricks in the sport, this one included. */
  readonly inSport: number;
  /** The tier's name: "Spicy". */
  readonly tier: string;
  readonly diff: Difficulty;
}

export function trickPositionFacts(trick: Trick, tricks: TrickList = TRICKS): TrickPositionFacts {
  // The trick itself always counts, live or not: a page is being drawn for it.
  const counted = tricks.filter((t) => t.isLive || t.id === trick.id);
  const inSport = counted.filter((t) => t.sport === trick.sport);
  const peers = inSport.filter((t) => t.cat === trick.cat && t.diff === trick.diff);
  return {
    peers: Math.max(1, peers.length),
    inSport: Math.max(1, inSport.length),
    tier: TIERS_LABEL[trick.diff - 1] ?? '',
    diff: trick.diff,
  };
}

/**
 * Tricks like this one: the same sport and category, within one difficulty
 * step, live, and never the trick itself. Nearest difficulty first, then by
 * name, cut to `n`.
 *
 * Plain string comparison for the name rather than `localeCompare`: the order
 * renders on a page, and anything ICU decides is a hydration risk (LESSONS
 * §3a). Trick names are ASCII and the two agree anyway; this makes it certain.
 */
export function similarTricks(trick: Trick, tricks: TrickList = TRICKS, n = 4): Trick[] {
  return tricks
    .filter(
      (t) =>
        t.isLive &&
        t.id !== trick.id &&
        t.sport === trick.sport &&
        t.cat === trick.cat &&
        Math.abs(t.diff - trick.diff) <= 1,
    )
    .sort((a, b) => {
      const gap = Math.abs(a.diff - trick.diff) - Math.abs(b.diff - trick.diff);
      if (gap !== 0) return gap;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    })
    .slice(0, Math.max(0, n));
}
